import { describe, expect, it } from 'vitest';
import type { Timers } from '../../../../src/presentation/http/Clock.js';
import { collect, controller } from './httpFixture.js';

describe('SimulationController — rotas', () => {
  it('GET /api/state devolve o estado e o relógio', async () => {
    const response = await controller().handle({
      method: 'GET',
      path: '/api/state',
      body: undefined,
    });

    expect(response).toMatchObject({
      status: 200,
      body: {
        type: 'update',
        state: { tick: 0, fleet: { robotCount: 2 } },
        clock: { playing: false },
        events: [],
      },
    });
  });

  it('POST /api/orders põe as ordens na fila e avisa os inscritos', async () => {
    const api = controller();
    const updates = collect(api);

    const response = await api.handle({
      method: 'POST',
      path: '/api/orders',
      body: { line: '1:N 9:N' },
    });

    expect(response).toEqual({
      status: 200,
      body: [
        { ok: true, input: '1:N', robotId: 1 },
        { ok: false, error: 'UNKNOWN_ROBOT', input: '9:N', robotId: 9 },
      ],
    });
    expect(updates).toHaveLength(1);
    expect(updates[0]?.state.robots[0]?.program).toBe('orders');
  });

  it('POST /api/clock/step avança 1 tick e envia os eventos', async () => {
    const api = controller();
    const updates = collect(api);
    await api.handle({
      method: 'POST',
      path: '/api/orders',
      body: { line: '1:N' },
    });

    await api.handle({ method: 'POST', path: '/api/clock/step', body: {} });

    expect(updates.at(-1)).toMatchObject({
      state: { tick: 1 },
      events: [{ tick: 1, robot: 1, kind: 'moved', position: { x: 0, y: 1 } }],
    });
  });

  it('POST /api/robots/:id/script carrega o script', async () => {
    const api = controller();

    expect(
      await api.handle({
        method: 'POST',
        path: '/api/robots/2/script',
        body: { source: 'wait()' },
      }),
    ).toEqual({ status: 200, body: { ok: true } });
    expect(
      await api.handle({
        method: 'POST',
        path: '/api/robots/2/script',
        body: { source: 'wait(' },
      }),
    ).toMatchObject({ status: 400, body: { error: 'SYNTAX', line: 1 } });
    expect(
      await api.handle({
        method: 'POST',
        path: '/api/robots/5/script',
        body: { source: '' },
      }),
    ).toMatchObject({ status: 404, body: { error: 'UNKNOWN_ROBOT' } });
  });

  it('POST /api/robots/:id/stop para o programa', async () => {
    const api = controller();
    await api.handle({
      method: 'POST',
      path: '/api/orders',
      body: { line: '1:NN' },
    });

    expect(
      await api.handle({
        method: 'POST',
        path: '/api/robots/1/stop',
        body: undefined,
      }),
    ).toEqual({ status: 200, body: { ok: true, stopped: true } });
    expect(
      await api.handle({
        method: 'POST',
        path: '/api/robots/8/stop',
        body: undefined,
      }),
    ).toMatchObject({ status: 404 });
  });

  it.each([
    ['/api/orders', undefined],
    ['/api/orders', { line: 3 }],
    ['/api/robots/1/script', {}],
  ])('POST %s com corpo inválido: 400', async (path, body) => {
    expect(
      await controller().handle({ method: 'POST', path, body }),
    ).toMatchObject({ status: 400 });
  });

  it.each([
    ['GET', '/api/orders'],
    ['GET', '/api/robots/1/script'],
    ['POST', '/api/nada'],
  ])('%s %s não existe: 404', async (method, path) => {
    expect(
      await controller().handle({ method, path, body: undefined }),
    ).toMatchObject({ status: 404 });
  });
});

describe('SimulationController — relógio', () => {
  function manualTimers(): Timers & { fire: () => void } {
    let callback: (() => void) | null = null;
    return {
      setInterval: (cb) => {
        callback = cb;
        return 1;
      },
      clearInterval: () => {
        callback = null;
      },
      fire: () => {
        callback?.();
      },
    };
  }

  const flush = (): Promise<void> => new Promise((done) => setTimeout(done, 0));

  it('play/pause e velocidade', async () => {
    const api = controller(manualTimers());

    expect(
      await api.handle({ method: 'POST', path: '/api/clock/play', body: {} }),
    ).toEqual({ status: 200, body: { playing: true, ticksPerSecond: 4 } });
    expect(
      await api.handle({
        method: 'PUT',
        path: '/api/clock/speed',
        body: { ticksPerSecond: 10 },
      }),
    ).toEqual({ status: 200, body: { playing: true, ticksPerSecond: 10 } });
    expect(
      await api.handle({ method: 'POST', path: '/api/clock/pause', body: {} }),
    ).toEqual({ status: 200, body: { playing: false, ticksPerSecond: 10 } });
  });

  it.each([{ ticksPerSecond: 0 }, { ticksPerSecond: 'x' }, undefined])(
    'velocidade inválida: %j',
    async (body) => {
      expect(
        await controller().handle({
          method: 'PUT',
          path: '/api/clock/speed',
          body,
        }),
      ).toMatchObject({ status: 400 });
    },
  );

  it('tocando, cada intervalo avança 1 tick; sem programa não avisa', async () => {
    const timers = manualTimers();
    const api = controller(timers);
    const updates = collect(api);
    await api.handle({ method: 'POST', path: '/api/clock/play', body: {} });
    await api.handle({
      method: 'POST',
      path: '/api/orders',
      body: { line: '1:N' },
    });
    const before = updates.length;

    timers.fire();
    await flush();
    timers.fire();
    await flush();
    timers.fire();
    await flush();

    // tick 1: andou; tick 2: terminou; depois disso, nada
    expect(updates.slice(before).map((u) => u.state.tick)).toEqual([1, 2]);
  });
});

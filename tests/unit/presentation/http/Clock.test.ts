import { describe, expect, it, vi } from 'vitest';
import {
  Clock,
  DEFAULT_SPEED,
  MAX_SPEED,
  type Timers,
} from '../../../../src/presentation/http/Clock.js';

// Timers de mentira: guardam o callback e o intervalo
function fakeTimers(): Timers & {
  fire: () => void;
  interval: number | null;
} {
  let callback: (() => void) | null = null;
  const timers = {
    interval: null as number | null,
    setInterval: (cb: () => void, ms: number) => {
      callback = cb;
      timers.interval = ms;
      return 1;
    },
    clearInterval: () => {
      callback = null;
      timers.interval = null;
    },
    fire: () => {
      callback?.();
    },
  };
  return timers;
}

describe('Clock — RN17', () => {
  it('começa pausado, na velocidade padrão', () => {
    const clock = new Clock(() => Promise.resolve(), { timers: fakeTimers() });

    expect(clock.toDTO()).toEqual({
      playing: false,
      ticksPerSecond: DEFAULT_SPEED,
    });
  });

  it('play chama o tick a cada intervalo; pause para', async () => {
    const timers = fakeTimers();
    const tick = vi.fn(() => Promise.resolve());
    const clock = new Clock(tick, { timers });

    clock.play();
    clock.play();
    expect(timers.interval).toBe(1000 / DEFAULT_SPEED);
    timers.fire();
    await Promise.resolve();
    timers.fire();
    await Promise.resolve();
    clock.pause();
    clock.pause();
    timers.fire();

    expect(tick).toHaveBeenCalledTimes(2);
    expect(clock.playing).toBe(false);
  });

  it('não começa um tick antes do anterior terminar', async () => {
    const timers = fakeTimers();
    let finish = (): void => undefined;
    const tick = vi.fn(
      () =>
        new Promise<void>((done) => {
          finish = done;
        }),
    );
    const clock = new Clock(tick, { timers });
    clock.play();

    timers.fire();
    timers.fire();
    expect(tick).toHaveBeenCalledTimes(1);
    finish();
    await new Promise((done) => setTimeout(done, 0));
    timers.fire();

    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('erro no tick vai para onError e o relógio continua', async () => {
    const timers = fakeTimers();
    const onError = vi.fn();
    const clock = new Clock(() => Promise.reject(new Error('x')), {
      timers,
      onError,
    });
    clock.play();

    timers.fire();
    await new Promise((done) => setTimeout(done, 0));

    expect(onError).toHaveBeenCalledOnce();
    expect(clock.playing).toBe(true);
  });

  it('mudar a velocidade tocando reinicia o intervalo', () => {
    const timers = fakeTimers();
    const clock = new Clock(() => Promise.resolve(), { timers });
    clock.play();

    clock.setSpeed(10);

    expect(timers.interval).toBe(100);
    expect(clock.ticksPerSecond).toBe(10);
  });

  it.each([0, MAX_SPEED + 1, 2.5, Number.NaN])(
    'velocidade inválida: %s',
    (speed) => {
      const clock = new Clock(() => Promise.resolve(), {
        timers: fakeTimers(),
      });

      expect(() => {
        clock.setSpeed(speed);
      }).toThrow(RangeError);
    },
  );
});

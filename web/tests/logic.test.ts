import { describe, expect, it } from 'vitest';
import { ApiClient, type Fetch } from '../src/api/client.js';
import type { EventDTO, MapDTO } from '../src/api/types.js';
import {
  appendEvents,
  describeEvent,
  lastErrors,
  visibleLines,
} from '../src/logic/events.js';
import { exploration, mapRows } from '../src/logic/mapCells.js';
import { rejectionText } from '../src/logic/orders.js';
import {
  EXAMPLE_SCRIPT,
  insertIndent,
  loadSavedScript,
  saveScript,
} from '../src/logic/scripts.js';

// Malha de -1 a 1; robô 1 em (0,0) olhando L; robô 2 visível em (1,1); obstáculo em (-1,1)
const map: MapDTO = {
  min: -1,
  max: 1,
  explored: [
    { x: -1, y: 1, blocked: true },
    { x: 0, y: 1, blocked: false },
    { x: 1, y: 1, blocked: false },
    { x: 0, y: 0, blocked: false },
  ],
  robot: { id: 1, x: 0, y: 0, orientation: 'L' },
  others: [{ id: 2, x: 1, y: 1, orientation: 'N' }],
};

describe('mapRows — RN12', () => {
  it('Norte para cima, com o desconhecido, os obstáculos e os robôs', () => {
    const kinds = mapRows(map).map((row) => row.map((cell) => cell.kind));

    expect(kinds).toEqual([
      ['obstacle', 'free', 'other'],
      ['unknown', 'self', 'unknown'],
      ['unknown', 'unknown', 'unknown'],
    ]);
    expect(mapRows(map)[1]?.[1]).toMatchObject({
      robotId: 1,
      orientation: 'L',
    });
  });

  it('exploration conta as casas conhecidas', () => {
    expect(exploration(map)).toEqual({ known: 4, total: 9 });
  });
});

const event = (body: Partial<EventDTO> & Pick<EventDTO, 'kind'>): EventDTO =>
  ({ tick: 3, robot: 1, ...body }) as EventDTO;

describe('describeEvent', () => {
  it.each([
    [
      event({
        kind: 'moved',
        position: { x: 0, y: 1 },
        orientation: 'N',
      }),
      'andou para (0, 1)',
      'quiet',
    ],
    [
      event({
        kind: 'turned',
        position: { x: 0, y: 1 },
        orientation: 'S',
      }),
      'virou para o Sul',
      'quiet',
    ],
    [event({ kind: 'waited' }), 'esperou', 'quiet'],
    [
      event({
        kind: 'blocked',
        reason: 'edge',
        at: { x: 0, y: 4 },
        other: null,
      }),
      'parou na borda da malha, antes de (0, 4)',
      'warn',
    ],
    [
      event({
        kind: 'blocked',
        reason: 'obstacle',
        at: { x: 0, y: 2 },
        other: null,
      }),
      'parou diante de um obstáculo em (0, 2)',
      'warn',
    ],
    [
      event({
        kind: 'blocked',
        reason: 'robot',
        at: { x: 1, y: 0 },
        other: 2,
      }),
      'parou diante do robô 2 em (1, 0)',
      'warn',
    ],
    [
      event({ kind: 'shared', to: 2, added: 1 }),
      'enviou o mapa ao robô 2: 1 casa nova',
      'info',
    ],
    [
      event({ kind: 'shared', to: 2, added: 0 }),
      'enviou o mapa ao robô 2: 0 casas novas',
      'info',
    ],
    [
      event({
        kind: 'shareFailed',
        to: 2,
        reason: 'notAdjacent',
      }),
      'não enviou o mapa: o robô 2 não está ao lado',
      'warn',
    ],
    [
      event({
        kind: 'shareFailed',
        to: 9,
        reason: 'unknownRobot',
      }),
      'não enviou o mapa: o robô 9 não existe',
      'warn',
    ],
    [
      event({ kind: 'shareFailed', to: 1, reason: 'self' }),
      'não enviou o mapa: não dá para enviar para si mesmo',
      'warn',
    ],
    [event({ kind: 'printed', text: 'oi' }), 'oi', 'print'],
    [event({ kind: 'finished' }), 'terminou o programa', 'info'],
    [
      event({
        kind: 'error',
        message: 'x',
        line: 2,
        column: 5,
      }),
      'erro na linha 2, coluna 5: x',
      'error',
    ],
  ])('%j', (input, text, tone) => {
    expect(describeEvent(input)).toEqual({ text, tone });
  });
});

describe('diário', () => {
  it('appendEvents numera as linhas e guarda só as últimas', () => {
    const first = appendEvents([], [event({ kind: 'waited' })], 2);
    const second = appendEvents(
      first,
      [event({ kind: 'finished' }), event({ kind: 'waited', robot: 2 })],
      2,
    );

    expect(second.map((line) => [line.id, line.text])).toEqual([
      [2, 'terminou o programa'],
      [3, 'esperou'],
    ]);
  });

  it('visibleLines filtra por robô, esconde passos e inverte a ordem', () => {
    const log = appendEvents(
      [],
      [
        event({ kind: 'waited' }),
        event({ kind: 'finished' }),
        event({ kind: 'finished', robot: 2 }),
      ],
    );

    expect(
      visibleLines(log, { robot: null, showSteps: false }).map((l) => l.id),
    ).toEqual([3, 2]);
    expect(
      visibleLines(log, { robot: 1, showSteps: true }).map((l) => l.id),
    ).toEqual([2, 1]);
  });

  it('lastErrors guarda o último erro de cada robô', () => {
    const errors = lastErrors([
      event({ kind: 'error', message: 'a', line: 1, column: 1 }),
      event({ kind: 'error', message: 'b', line: 4, column: 2 }),
      event({ kind: 'finished', robot: 2 }),
    ]);

    expect([...errors]).toEqual([[1, { line: 4, column: 2, message: 'b' }]]);
  });
});

describe('ordens recusadas', () => {
  it.each([
    [{ ok: true, input: '1:N', robotId: 1 } as const, null],
    [
      { ok: false, error: 'INVALID_ORDER', input: 'NN' } as const,
      '"NN" não é uma ordem: use ID:COMANDOS (1:NNDE) ou DE>PARA (1>2)',
    ],
    [
      { ok: false, error: 'INVALID_COMMAND', input: '1:X' } as const,
      '"1:X" tem letras inválidas: use só N, S, L, O, D, E',
    ],
    [
      {
        ok: false,
        error: 'UNKNOWN_ROBOT',
        input: '9:N',
        robotId: 9,
      } as const,
      '"9:N": não existe robô com ID 9',
    ],
  ])('%j', (result, text) => {
    expect(rejectionText(result)).toBe(text);
  });
});

describe('scripts', () => {
  it('sem script salvo, começa com o exemplo; depois lembra o que foi salvo', () => {
    const items = new Map<string, string>();
    const storage = {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => {
        items.set(key, value);
      },
    };

    expect(loadSavedScript(storage, 1)).toBe(EXAMPLE_SCRIPT);
    saveScript(storage, 1, 'wait()');
    expect(loadSavedScript(storage, 1)).toBe('wait()');
    expect(loadSavedScript(storage, 2)).toBe(EXAMPLE_SCRIPT);
  });

  it('Tab troca a seleção por 2 espaços', () => {
    expect(insertIndent('ab', 1, 2)).toEqual({ source: 'a  ', cursor: 3 });
  });
});

describe('ApiClient', () => {
  function fakeFetch(status: number, body: unknown) {
    const calls: { path: string; init: RequestInit | undefined }[] = [];
    const fetchImpl: Fetch = (path, init) => {
      calls.push({ path, init });
      return Promise.resolve(new Response(JSON.stringify(body), { status }));
    };
    return { calls, fetchImpl };
  }

  it('envia as ordens em JSON', async () => {
    const { calls, fetchImpl } = fakeFetch(200, []);

    await new ApiClient(fetchImpl).sendOrders('1:N');

    expect(calls).toMatchObject([
      { path: '/api/orders', init: { method: 'POST', body: '{"line":"1:N"}' } },
    ]);
  });

  it('erro de sintaxe (400) volta como resultado', async () => {
    const body = {
      ok: false,
      error: 'SYNTAX',
      message: 'x',
      line: 1,
      column: 1,
    };
    const { calls, fetchImpl } = fakeFetch(400, body);

    expect(await new ApiClient(fetchImpl).loadScript(2, 'f(')).toEqual(body);
    expect(calls[0]?.path).toBe('/api/robots/2/script');
  });

  it('outros erros viram exceção', async () => {
    const { fetchImpl } = fakeFetch(500, { error: 'Erro interno' });

    await expect(new ApiClient(fetchImpl).play()).rejects.toThrow('500');
  });

  it.each([
    ['stopProgram', '/api/robots/3/stop', 'POST'],
    ['pause', '/api/clock/pause', 'POST'],
    ['step', '/api/clock/step', 'POST'],
    ['setSpeed', '/api/clock/speed', 'PUT'],
  ] as const)('%s chama %s', async (method, path, verb) => {
    const { calls, fetchImpl } = fakeFetch(200, { ok: true });
    const client = new ApiClient(fetchImpl);

    await (method === 'stopProgram'
      ? client.stopProgram(3)
      : method === 'setSpeed'
        ? client.setSpeed(5)
        : client[method]());

    expect(calls[0]).toMatchObject({ path, init: { method: verb } });
  });
});

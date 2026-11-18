import { beforeEach, describe, expect, it } from 'vitest';
import {
  ExecuteOrders,
  type OrderResult,
} from '../../../src/application/use-cases/ExecuteOrders.js';
import { Fleet, type Placement } from '../../../src/domain/entities/Fleet.js';
import { Grid } from '../../../src/domain/value-objects/Grid.js';
import { Obstacle } from '../../../src/domain/value-objects/Obstacle.js';
import { Position } from '../../../src/domain/value-objects/Position.js';
import { InMemoryFleetRepository } from '../../../src/infrastructure/repositories/InMemoryFleetRepository.js';

const at = (x: number, y: number): Position => Position.create(x, y);

// Robô 1 na origem, 2 em (-3,3) e 3 em (3,3)
const starts = (count: number): Placement[] =>
  [at(0, 0), at(-3, 3), at(3, 3)]
    .slice(0, count)
    .map((position) => ({ position }));

function executeOn(fleet: Fleet): ExecuteOrders {
  return new ExecuteOrders(new InMemoryFleetRepository(fleet));
}

// Critérios de aceite de docs/requisitos.md, seção 6, com um robô só (ordem "1:" + comando)
describe('ExecuteOrders — um robô', () => {
  let orders: ExecuteOrders;

  // Executa "1:<comando>" e devolve o único resultado
  async function move(command: string): Promise<OrderResult | undefined> {
    const [result] = await orders.execute(`1:${command}`);
    return result;
  }

  beforeEach(() => {
    orders = new ExecuteOrders(new InMemoryFleetRepository());
  });

  it.each([
    ['CA01', 'N', 0, 1],
    ['CA02', 'S', 0, -1],
    ['CA03', 'L', 1, 0],
    ['CA04', 'O', -1, 0],
    ['CA05', 'NLLSSSS', 2, -3],
    ['CA06', 'NSLO', 0, 0],
    ['CA07', 'N'.repeat(15), 0, 15],
    ['CA08', 'S'.repeat(15) + 'O'.repeat(15), -15, -15],
    ['CA13', '', 0, 0],
  ])('%s — "1:%s" leva a (%i,%i)', async (_ca, input, x, y) => {
    expect(await move(input)).toEqual({
      ok: true,
      kind: 'move',
      robot: { id: 1, x, y, orientation: 'N' },
    });
  });

  it.each([
    ['CA09', 'N'.repeat(16)],
    ['CA10', 'N'.repeat(16) + 'S'],
  ])(
    '%s — sair da malha é rejeitado e o robô fica em (0,0)',
    async (_ca, input) => {
      expect(await move(input)).toEqual({
        ok: false,
        error: 'OUT_OF_GRID',
        robot: { id: 1, x: 0, y: 0, orientation: 'N' },
      });
    },
  );

  it('CA11 — a posição persiste entre comandos', async () => {
    await move('N');

    expect(await move('L')).toMatchObject({ robot: { x: 1, y: 1 } });
  });

  it('CA12 — comando rejeitado mantém a posição do comando anterior', async () => {
    await move('N');

    expect(await move('S'.repeat(17))).toMatchObject({
      ok: false,
      robot: { x: 0, y: 1 },
    });
    expect(await move('')).toMatchObject({ ok: true, robot: { x: 0, y: 1 } });
  });

  it.each([
    ['CA14', 'n'],
    ['CA15', 'N-L'],
    ['CA16', '1N'],
    ['CA17', 'NXN'],
    ['CA28', 'd'],
  ])('%s — "1:%s" é entrada inválida', async (_ca, input) => {
    expect(await move(input)).toEqual({
      ok: false,
      error: 'INVALID_COMMAND',
      input: `1:${input}`,
    });
    expect(await move('')).toMatchObject({ robot: { x: 0, y: 0 } });
  });

  it.each([
    ['CA18', 'D', 0, 0, 'L'],
    ['CA19', 'E', 0, 0, 'O'],
    ['CA20', 'DDDD', 0, 0, 'N'],
    ['CA21', 'DN', 1, 0, 'L'],
    ['CA22', 'DDN', 0, -1, 'S'],
    ['CA23', 'DDS', 0, 1, 'S'],
    ['CA24', 'DL', 0, -1, 'L'],
    ['CA25', 'EN', -1, 0, 'O'],
  ])(
    '%s — "1:%s" leva a (%i,%i) olhando para %s',
    async (_ca, input, x, y, orientation) => {
      expect(await move(input)).toEqual({
        ok: true,
        kind: 'move',
        robot: { id: 1, x, y, orientation },
      });
    },
  );

  it('CA26 — comando rejeitado mantém posição e orientação', async () => {
    expect(await move('D' + 'N'.repeat(16))).toMatchObject({
      ok: false,
      robot: { x: 0, y: 0, orientation: 'N' },
    });
  });

  it('CA27 — a orientação persiste entre comandos', async () => {
    await move('D');

    expect(await move('N')).toMatchObject({
      robot: { x: 1, y: 0, orientation: 'L' },
    });
  });
});

describe('ExecuteOrders — obstáculos e malha configurável', () => {
  let orders: ExecuteOrders;

  beforeEach(() => {
    orders = executeOn(
      Fleet.create(
        Grid.square(15, [Obstacle.create([at(0, 2)])]),
        1,
        Math.random,
      ),
    );
  });

  it.each([
    ['CA29', 'NN'],
    ['CA30', 'NNN'],
    ['CA31', 'DDSS'],
  ])(
    '%s — "1:%s" bate no obstáculo e o robô fica em (0,0) olhando N',
    async (_ca, input) => {
      expect(await orders.execute(`1:${input}`)).toEqual([
        {
          ok: false,
          error: 'OBSTACLE',
          obstacle: { x: 0, y: 2 },
          robot: { id: 1, x: 0, y: 0, orientation: 'N' },
        },
      ]);
    },
  );

  it('CA32 — o robô pode contornar o obstáculo', async () => {
    expect(await orders.execute('1:LNNNO')).toMatchObject([
      { ok: true, robot: { x: 0, y: 3 } },
    ]);
  });

  it('CA33 — comando rejeitado por obstáculo mantém a posição anterior', async () => {
    expect(await orders.execute('1:N 1:N')).toMatchObject([
      { ok: true, robot: { x: 0, y: 1 } },
      { ok: false, error: 'OBSTACLE', robot: { x: 0, y: 1 } },
    ]);
  });

  it('CA34 — numa malha de limite 5, o 6º passo sai da malha', async () => {
    const small = executeOn(Fleet.create(Grid.square(5), 1, Math.random));

    expect(await small.execute(`1:${'N'.repeat(5)} 1:N`)).toMatchObject([
      { ok: true, robot: { x: 0, y: 5 } },
      { ok: false, error: 'OUT_OF_GRID', robot: { x: 0, y: 5 } },
    ]);
  });
});

// Malha limite 3 sem obstáculos, 3 robôs: 1 em (0,0), 2 em (-3,3), 3 em (3,3)
describe('ExecuteOrders — vários robôs', () => {
  let orders: ExecuteOrders;

  beforeEach(() => {
    orders = executeOn(Fleet.place(Grid.square(3), starts(3)));
  });

  it('CA50 — várias ordens na mesma linha, cada uma para o seu robô', async () => {
    expect(await orders.execute('1:N 2:DN')).toEqual([
      {
        ok: true,
        kind: 'move',
        robot: { id: 1, x: 0, y: 1, orientation: 'N' },
      },
      {
        ok: true,
        kind: 'move',
        robot: { id: 2, x: -2, y: 3, orientation: 'L' },
      },
    ]);
  });

  it('CA51 — o mesmo robô pode receber várias ordens, em sequência', async () => {
    expect(await orders.execute('2:DN 2:N')).toMatchObject([
      { robot: { id: 2, x: -2, y: 3 } },
      { robot: { id: 2, x: -1, y: 3 } },
    ]);
  });

  it.each(['NN', '0:N', '1:N:', '1>1'])(
    'CA52 — "%s" é uma ordem em formato inválido',
    async (input) => {
      const [result] = await orders.execute(input);

      expect(result?.ok).toBe(false);
      expect(result).toHaveProperty(
        'error',
        input === '1:N:' ? 'INVALID_COMMAND' : 'INVALID_ORDER',
      );
    },
  );

  it('CA53 — robô inexistente', async () => {
    expect(await orders.execute('9:N')).toEqual([
      { ok: false, error: 'UNKNOWN_ROBOT', robotId: 9 },
    ]);
  });

  it('CA54 — cada ordem é independente: um erro não impede as outras', async () => {
    expect(await orders.execute('1:N 2:X 3:EN')).toMatchObject([
      { ok: true, robot: { id: 1, x: 0, y: 1 } },
      { ok: false, error: 'INVALID_COMMAND', input: '2:X' },
      { ok: true, robot: { id: 3, x: 2, y: 3, orientation: 'O' } },
    ]);
  });

  it('CA61 — linha vazia não executa nada', async () => {
    expect(await orders.execute('')).toEqual([]);
  });
});

// Robô 1 em (0,0) e robô 2 em (0,2), malha limite 3
describe('ExecuteOrders — colisão', () => {
  const placements: Placement[] = [
    { position: at(0, 0) },
    { position: at(0, 2) },
  ];
  let orders: ExecuteOrders;

  beforeEach(() => {
    orders = executeOn(Fleet.place(Grid.square(3), placements));
  });

  it.each([
    ['CA55', 'NN'],
    ['CA56', 'NNN'],
  ])(
    '%s — "1:%s" bate no robô 2 e o robô 1 fica em (0,0)',
    async (_ca, input) => {
      expect(await orders.execute(`1:${input}`)).toEqual([
        {
          ok: false,
          error: 'COLLISION',
          other: 2,
          at: { x: 0, y: 2 },
          robot: { id: 1, x: 0, y: 0, orientation: 'N' },
        },
      ]);
    },
  );

  it('CA57 — as ordens rodam em sequência: o robô 2 sai e libera a casa', async () => {
    expect(await orders.execute('2:L 1:NN')).toMatchObject([
      { ok: true, robot: { id: 2, x: 1, y: 2 } },
      { ok: true, robot: { id: 1, x: 0, y: 2 } },
    ]);
  });
});

describe('ExecuteOrders — compartilhar mapa', () => {
  it('CA62 — robôs lado a lado: o receptor ganha as casas que não conhecia', async () => {
    const orders = executeOn(
      Fleet.place(Grid.square(3), [
        { position: at(0, 0) },
        { position: at(1, 0) },
      ]),
    );

    expect(await orders.execute('1>2 1>2')).toEqual([
      { ok: true, kind: 'share', from: 1, to: 2, added: 3 },
      { ok: true, kind: 'share', from: 1, to: 2, added: 0 },
    ]);
  });

  it('CA63 — robôs longe um do outro não compartilham', async () => {
    const orders = executeOn(Fleet.place(Grid.square(3), starts(2)));

    expect(await orders.execute('1>2')).toEqual([
      { ok: false, error: 'NOT_ADJACENT', from: 1, to: 2 },
    ]);
  });

  it('CA64 — dá para andar e compartilhar na mesma linha', async () => {
    const orders = executeOn(
      Fleet.place(Grid.square(3), [
        { position: at(0, 0) },
        { position: at(0, 3) },
      ]),
    );

    expect(await orders.execute('1:NN 1>2')).toMatchObject([
      { ok: true, robot: { id: 1, x: 0, y: 2 } },
      { ok: true, kind: 'share', from: 1, to: 2 },
    ]);
  });

  it('robô inexistente no compartilhamento', async () => {
    const orders = executeOn(Fleet.create(Grid.square(3), 1, Math.random));

    expect(await orders.execute('1>4')).toEqual([
      { ok: false, error: 'UNKNOWN_ROBOT', robotId: 4 },
    ]);
  });
});

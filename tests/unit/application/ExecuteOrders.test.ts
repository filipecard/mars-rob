import { beforeEach, describe, expect, it } from 'vitest';
import type { RobotStateDTO } from '../../../src/application/dto.js';
import { AdvanceClock } from '../../../src/application/use-cases/AdvanceClock.js';
import { DescribeMap } from '../../../src/application/use-cases/DescribeMap.js';
import { ExecuteOrders } from '../../../src/application/use-cases/ExecuteOrders.js';
import { Fleet, type Placement } from '../../../src/domain/entities/Fleet.js';
import { Grid } from '../../../src/domain/value-objects/Grid.js';
import { Obstacle } from '../../../src/domain/value-objects/Obstacle.js';
import { Position } from '../../../src/domain/value-objects/Position.js';
import { InMemorySimulationRepository } from '../../../src/infrastructure/repositories/InMemorySimulationRepository.js';
import { play } from './play.js';

const at = (x: number, y: number): Position => Position.create(x, y);

// Robô 1 na origem, 2 em (-3,3) e 3 em (3,3)
const starts = (count: number): Placement[] =>
  [at(0, 0), at(-3, 3), at(3, 3)]
    .slice(0, count)
    .map((position) => ({ position }));

async function stateOf(
  repository: InMemorySimulationRepository,
  id: number,
): Promise<RobotStateDTO | undefined> {
  const result = await new DescribeMap(repository).execute(id);
  return result.ok ? result.map.robot : undefined;
}

// Critérios de aceite de docs/requisitos.md, seção 6, com um robô só (ordem "1:" + comando)
describe('Ordens — um robô', () => {
  let repository: InMemorySimulationRepository;

  // Executa "1:<comando>" até o fim e devolve o estado final e os eventos
  async function move(command: string) {
    const run = await play(repository, `1:${command}`);
    return { ...run, robot: await stateOf(repository, 1) };
  }

  beforeEach(() => {
    repository = new InMemorySimulationRepository();
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
    const { results, robot } = await move(input);

    expect(results).toEqual([{ ok: true, input: `1:${input}`, robotId: 1 }]);
    expect(robot).toEqual({ id: 1, x, y, orientation: 'N' });
  });

  it.each([
    ['CA09', 'N'.repeat(16)],
    ['CA10', 'N'.repeat(16) + 'S'],
  ])(
    '%s — o robô anda até a borda e para no passo que sairia da malha',
    async (_ca, input) => {
      const { robot, events } = await move(input);

      expect(robot).toMatchObject({ x: 0, y: 15 });
      expect(events.filter((e) => e.kind === 'blocked')).toEqual([
        {
          tick: 16,
          robot: 1,
          kind: 'blocked',
          reason: 'edge',
          at: { x: 0, y: 16 },
          other: null,
        },
      ]);
    },
  );

  it('CA11 — a posição persiste entre comandos', async () => {
    await move('N');

    expect((await move('L')).robot).toMatchObject({ x: 1, y: 1 });
  });

  it('CA12 — comando que falha mantém os passos que já deu', async () => {
    await move('N');

    expect((await move('S'.repeat(17))).robot).toMatchObject({
      x: 0,
      y: -15,
    });
    expect((await move('')).robot).toMatchObject({ x: 0, y: -15 });
  });

  it.each([
    ['CA14', 'n'],
    ['CA15', 'N-L'],
    ['CA16', '1N'],
    ['CA17', 'NXN'],
    ['CA28', 'd'],
  ])('%s — "1:%s" é entrada inválida', async (_ca, input) => {
    const { results, advanced, robot } = await move(input);

    expect(results).toEqual([
      { ok: false, error: 'INVALID_COMMAND', input: `1:${input}` },
    ]);
    expect(advanced).toBe(0);
    expect(robot).toMatchObject({ x: 0, y: 0 });
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
      expect((await move(input)).robot).toEqual({ id: 1, x, y, orientation });
    },
  );

  it('CA26 — comando que falha mantém o giro e os passos já dados', async () => {
    expect((await move('D' + 'N'.repeat(16))).robot).toMatchObject({
      x: 15,
      y: 0,
      orientation: 'L',
    });
  });

  it('CA27 — a orientação persiste entre comandos', async () => {
    await move('D');

    expect((await move('N')).robot).toMatchObject({
      x: 1,
      y: 0,
      orientation: 'L',
    });
  });

  it('CA66 — cada letra gasta 1 tick — RN17', async () => {
    const { advanced, tick, events } = await move('NDN');

    expect(advanced).toBe(4);
    expect(tick).toBe(4);
    expect(events.map((e) => `${String(e.tick)}:${e.kind}`)).toEqual([
      '1:moved',
      '2:turned',
      '3:moved',
      '4:finished',
    ]);
  });
});

describe('Ordens — obstáculos e malha configurável', () => {
  let repository: InMemorySimulationRepository;

  beforeEach(() => {
    repository = InMemorySimulationRepository.of(
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
  ])('%s — "1:%s" para em (0,1), antes do obstáculo', async (_ca, input) => {
    const { events } = await play(repository, `1:${input}`);

    expect(events.filter((e) => e.kind === 'blocked')).toMatchObject([
      { reason: 'obstacle', at: { x: 0, y: 2 } },
    ]);
    expect(await stateOf(repository, 1)).toMatchObject({ x: 0, y: 1 });
  });

  it('CA32 — o robô pode contornar o obstáculo', async () => {
    await play(repository, '1:LNNNO');

    expect(await stateOf(repository, 1)).toMatchObject({ x: 0, y: 3 });
  });

  it('CA33 — a ordem que bate no obstáculo não desfaz a anterior', async () => {
    const { events } = await play(repository, '1:N 1:N');

    expect(events.filter((e) => e.kind === 'blocked')).toHaveLength(1);
    expect(await stateOf(repository, 1)).toMatchObject({ x: 0, y: 1 });
  });

  it('CA34 — numa malha de limite 5, o 6º passo sai da malha', async () => {
    const small = InMemorySimulationRepository.of(
      Fleet.create(Grid.square(5), 1, Math.random),
    );

    const { events } = await play(small, `1:${'N'.repeat(5)} 1:N`);

    expect(events.filter((e) => e.kind === 'blocked')).toMatchObject([
      { reason: 'edge', at: { x: 0, y: 6 } },
    ]);
    expect(await stateOf(small, 1)).toMatchObject({ x: 0, y: 5 });
  });

  it('CA67 — se uma ordem falha, a próxima ordem do mesmo robô continua — RN14', async () => {
    await play(repository, '1:NNN 1:L');

    expect(await stateOf(repository, 1)).toMatchObject({ x: 1, y: 1 });
  });
});

// Malha limite 3 sem obstáculos, 3 robôs: 1 em (0,0), 2 em (-3,3), 3 em (3,3)
describe('Ordens — vários robôs', () => {
  let repository: InMemorySimulationRepository;

  beforeEach(() => {
    repository = InMemorySimulationRepository.of(
      Fleet.place(Grid.square(3), starts(3)),
    );
  });

  it('CA50 — várias ordens na mesma linha, cada uma para o seu robô', async () => {
    await play(repository, '1:N 2:DN');

    expect(await stateOf(repository, 1)).toEqual({
      id: 1,
      x: 0,
      y: 1,
      orientation: 'N',
    });
    expect(await stateOf(repository, 2)).toEqual({
      id: 2,
      x: -2,
      y: 3,
      orientation: 'L',
    });
  });

  it('CA51 — o mesmo robô pode receber várias ordens, em sequência', async () => {
    await play(repository, '2:DN 2:N');

    expect(await stateOf(repository, 2)).toMatchObject({ x: -1, y: 3 });
  });

  it('CA68 — os robôs andam ao mesmo tempo, 1 passo por tick — RN17', async () => {
    await new ExecuteOrders(repository).execute('1:NN 3:SS');
    const { events } = await new AdvanceClock(repository).execute(1);

    expect(events).toEqual([
      {
        tick: 1,
        robot: 1,
        kind: 'moved',
        position: { x: 0, y: 1 },
        orientation: 'N',
      },
      {
        tick: 1,
        robot: 3,
        kind: 'moved',
        position: { x: 3, y: 2 },
        orientation: 'N',
      },
    ]);
  });

  it.each(['NN', '0:N', '1:N:', '1>1'])(
    'CA52 — "%s" é uma ordem em formato inválido',
    async (input) => {
      const [result] = await new ExecuteOrders(repository).execute(input);

      expect(result?.ok).toBe(false);
      expect(result).toHaveProperty(
        'error',
        input === '1:N:' ? 'INVALID_COMMAND' : 'INVALID_ORDER',
      );
    },
  );

  it('CA53 — robô inexistente', async () => {
    expect(await new ExecuteOrders(repository).execute('9:N')).toEqual([
      { ok: false, error: 'UNKNOWN_ROBOT', input: '9:N', robotId: 9 },
    ]);
  });

  it('CA54 — cada ordem é independente: um erro não impede as outras', async () => {
    const { results } = await play(repository, '1:N 2:X 3:EN');

    expect(results).toMatchObject([
      { ok: true, robotId: 1 },
      { ok: false, error: 'INVALID_COMMAND', input: '2:X' },
      { ok: true, robotId: 3 },
    ]);
    expect(await stateOf(repository, 1)).toMatchObject({ x: 0, y: 1 });
    expect(await stateOf(repository, 3)).toMatchObject({
      x: 2,
      y: 3,
      orientation: 'O',
    });
  });

  it('CA61 — linha vazia não executa nada', async () => {
    const { results, advanced } = await play(repository, '');

    expect(results).toEqual([]);
    expect(advanced).toBe(0);
  });
});

// Robô 1 em (0,0) e robô 2 em (0,2), malha limite 3
describe('Ordens — colisão', () => {
  let repository: InMemorySimulationRepository;

  beforeEach(() => {
    repository = InMemorySimulationRepository.of(
      Fleet.place(Grid.square(3), [
        { position: at(0, 0) },
        { position: at(0, 2) },
      ]),
    );
  });

  it.each([
    ['CA55', 'NN'],
    ['CA56', 'NNN'],
  ])('%s — "1:%s" para em (0,1), antes do robô 2', async (_ca, input) => {
    const { events } = await play(repository, `1:${input}`);

    expect(events.filter((e) => e.kind === 'blocked')).toEqual([
      {
        tick: 2,
        robot: 1,
        kind: 'blocked',
        reason: 'robot',
        at: { x: 0, y: 2 },
        other: 2,
      },
    ]);
    expect(await stateOf(repository, 1)).toMatchObject({ x: 0, y: 1 });
  });

  it('CA57 — o robô 2 sai no 1º tick e libera a casa para o 2º passo do 1', async () => {
    await play(repository, '2:L 1:NN');

    expect(await stateOf(repository, 2)).toMatchObject({ x: 1, y: 2 });
    expect(await stateOf(repository, 1)).toMatchObject({ x: 0, y: 2 });
  });
});

describe('Ordens — compartilhar mapa', () => {
  it('CA62 — robôs lado a lado: o receptor ganha as casas que não conhecia', async () => {
    const repository = InMemorySimulationRepository.of(
      Fleet.place(Grid.square(3), [
        { position: at(0, 0) },
        { position: at(1, 0) },
      ]),
    );

    const { events } = await play(repository, '1>2 1>2');

    expect(events.filter((e) => e.kind === 'shared')).toEqual([
      { tick: 1, robot: 1, kind: 'shared', to: 2, added: 3 },
      { tick: 2, robot: 1, kind: 'shared', to: 2, added: 0 },
    ]);
  });

  it('CA63 — robôs longe um do outro não compartilham', async () => {
    const repository = InMemorySimulationRepository.of(
      Fleet.place(Grid.square(3), starts(2)),
    );

    const { events } = await play(repository, '1>2');

    expect(events).toContainEqual({
      tick: 1,
      robot: 1,
      kind: 'shareFailed',
      to: 2,
      reason: 'notAdjacent',
    });
  });

  it('CA64 — dá para andar e compartilhar na mesma linha', async () => {
    const repository = InMemorySimulationRepository.of(
      Fleet.place(Grid.square(3), [
        { position: at(0, 0) },
        { position: at(0, 3) },
      ]),
    );

    const { events } = await play(repository, '1:NN 1>2');

    expect(events).toContainEqual(
      expect.objectContaining({ tick: 3, kind: 'shared', to: 2 }),
    );
  });

  it('robô inexistente no compartilhamento', async () => {
    const repository = InMemorySimulationRepository.of(
      Fleet.create(Grid.square(3), 1, Math.random),
    );

    expect(await new ExecuteOrders(repository).execute('1>4')).toEqual([
      { ok: false, error: 'UNKNOWN_ROBOT', input: '1>4', robotId: 4 },
    ]);
  });
});

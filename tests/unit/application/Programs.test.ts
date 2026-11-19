import { describe, expect, it } from 'vitest';
import { AdvanceClock } from '../../../src/application/use-cases/AdvanceClock.js';
import { DescribeSimulation } from '../../../src/application/use-cases/DescribeSimulation.js';
import { ExecuteOrders } from '../../../src/application/use-cases/ExecuteOrders.js';
import { ForgetMap } from '../../../src/application/use-cases/ForgetMap.js';
import { LoadScript } from '../../../src/application/use-cases/LoadScript.js';
import { StopProgram } from '../../../src/application/use-cases/StopProgram.js';
import { Fleet } from '../../../src/domain/entities/Fleet.js';
import { Grid } from '../../../src/domain/value-objects/Grid.js';
import { Position } from '../../../src/domain/value-objects/Position.js';
import { InMemorySimulationRepository } from '../../../src/infrastructure/repositories/InMemorySimulationRepository.js';

const at = (x: number, y: number): Position => Position.create(x, y);

// Malha limite 3; robô 1 em (0,0) e robô 2 em (3,3)
const repositoryWithTwo = (): InMemorySimulationRepository =>
  InMemorySimulationRepository.of(
    Fleet.place(Grid.square(3), [
      { position: at(0, 0) },
      { position: at(3, 3) },
    ]),
  );

describe('LoadScript — RN18', () => {
  it('carrega o script; ele roda nos ticks seguintes', async () => {
    const repository = repositoryWithTwo();

    expect(
      await new LoadScript(repository).execute(1, 'forward(); print("ok")'),
    ).toEqual({ ok: true });
    const { events } = await new AdvanceClock(repository).execute(10);

    expect(events).toContainEqual({
      tick: 2,
      robot: 1,
      kind: 'printed',
      text: 'ok',
    });
  });

  it('CA69 — erro de sintaxe com linha e coluna', async () => {
    expect(
      await new LoadScript(repositoryWithTwo()).execute(1, 'let x = \n  )'),
    ).toEqual({
      ok: false,
      error: 'SYNTAX',
      message: expect.any(String) as unknown,
      line: 2,
      column: 3,
    });
  });

  it('robô inexistente', async () => {
    expect(await new LoadScript(repositoryWithTwo()).execute(5, '')).toEqual({
      ok: false,
      error: 'UNKNOWN_ROBOT',
      robotId: 5,
    });
  });
});

describe('AdvanceClock — RN17', () => {
  it('avança no máximo maxTicks e diz quem ainda está rodando', async () => {
    const repository = repositoryWithTwo();
    await new LoadScript(repository).execute(2, 'while (true) { wait() }');

    const result = await new AdvanceClock(repository).execute(3);

    expect(result).toMatchObject({ tick: 3, advanced: 3, running: [2] });
    expect(result.events).toHaveLength(3);
  });

  it('para antes se nenhum robô tiver programa', async () => {
    const repository = repositoryWithTwo();
    await new ExecuteOrders(repository).execute('1:N');

    expect(await new AdvanceClock(repository).execute(50)).toMatchObject({
      tick: 2,
      advanced: 2,
      running: [],
    });
  });

  it.each([-1, 1.5])('maxTicks inválido: %s', async (ticks) => {
    await expect(
      new AdvanceClock(repositoryWithTwo()).execute(ticks),
    ).rejects.toThrow(RangeError);
  });
});

describe('StopProgram', () => {
  it('para o programa e diz se havia um', async () => {
    const repository = repositoryWithTwo();
    await new ExecuteOrders(repository).execute('1:NNN');
    const stop = new StopProgram(repository);

    expect(await stop.execute(1)).toEqual({ ok: true, stopped: true });
    expect(await stop.execute(1)).toEqual({ ok: true, stopped: false });
    expect(await stop.execute(7)).toEqual({
      ok: false,
      error: 'UNKNOWN_ROBOT',
      robotId: 7,
    });
  });
});

describe('DescribeSimulation', () => {
  it('relógio, malha, programa e mapa de cada robô', async () => {
    const repository = repositoryWithTwo();
    await new LoadScript(repository).execute(2, 'wait()');
    await new ExecuteOrders(repository).execute('1:N');
    await new AdvanceClock(repository).execute(1);

    const state = await new DescribeSimulation(repository).execute();

    expect(state).toMatchObject({
      tick: 1,
      fleet: { min: -3, max: 3, obstacleCount: 0, robotCount: 2 },
      robots: [
        { id: 1, program: 'orders', map: { robot: { x: 0, y: 1 } } },
        { id: 2, program: 'script', map: { robot: { x: 3, y: 3 } } },
      ],
    });
  });
});

describe('ForgetMap — RN20', () => {
  it('apaga o mapa e diz quantas casas foram esquecidas', async () => {
    const repository = repositoryWithTwo();
    await new ExecuteOrders(repository).execute('1:NN');
    await new AdvanceClock(repository).execute(10);

    // de (0,0) a (0,2): y de -1 a 3 (15 casas); fica com 9
    expect(await new ForgetMap(repository).execute(1)).toEqual({
      ok: true,
      forgotten: 6,
    });
    const state = await new DescribeSimulation(repository).execute();
    expect(state.robots[0]?.map.explored).toHaveLength(9);
  });

  it('CA78 — robô inexistente', async () => {
    expect(await new ForgetMap(repositoryWithTwo()).execute(9)).toEqual({
      ok: false,
      error: 'UNKNOWN_ROBOT',
      robotId: 9,
    });
  });
});

import { describe, expect, it } from 'vitest';
import { DescribeFleet } from '../../../src/application/use-cases/DescribeFleet.js';
import { DescribeMap } from '../../../src/application/use-cases/DescribeMap.js';
import { play } from './play.js';
import { Fleet, type Placement } from '../../../src/domain/entities/Fleet.js';
import { Grid } from '../../../src/domain/value-objects/Grid.js';
import { Obstacle } from '../../../src/domain/value-objects/Obstacle.js';
import { Position } from '../../../src/domain/value-objects/Position.js';
import { InMemorySimulationRepository } from '../../../src/infrastructure/repositories/InMemorySimulationRepository.js';

const at = (x: number, y: number): Position => Position.create(x, y);

// Robô 1 na origem, 2 em (-3,3) e 3 em (3,3)
const starts = (count: number): Placement[] =>
  [at(0, 0), at(-3, 3), at(3, 3)]
    .slice(0, count)
    .map((position) => ({ position }));
const sortCells = <T extends { x: number; y: number }>(cells: T[]): T[] =>
  [...cells].sort((a, b) => a.x - b.x || a.y - b.y);

describe('DescribeFleet', () => {
  it('devolve limites e quantidades, sem dizer onde os robôs estão — RN13', async () => {
    const grid = Grid.square(3, [Obstacle.create([at(2, 1)])]);
    const repository = InMemorySimulationRepository.of(
      Fleet.place(grid, starts(3)),
    );

    expect(await new DescribeFleet(repository).execute()).toEqual({
      min: -3,
      max: 3,
      obstacleCount: 1,
      robotCount: 3,
    });
  });
});

describe('DescribeMap', () => {
  const grid = Grid.square(3, [
    Obstacle.create([at(2, 1), at(2, 2)]),
    Obstacle.create([at(-3, 0)]),
  ]);

  it('expõe só as casas que o robô explorou, marcando os obstáculos — RN12', async () => {
    const repository = InMemorySimulationRepository.of(
      Fleet.create(grid, 1, Math.random),
    );
    await play(repository, '1:L');

    const result = await new DescribeMap(repository).execute(1);

    // Visão da origem (x de -1 a 1) + visão de (1,0) (x de 0 a 2), y de -1 a 1
    const expected = [-1, 0, 1, 2].flatMap((x) =>
      [-1, 0, 1].map((y) => ({
        x,
        y,
        blocked: x === 2 && y === 1,
        // RN19: só a origem e (1,0) foram pisadas
        visited: y === 0 && (x === 0 || x === 1),
        // RN23: a base fica na origem
        ground: x === 2 && y === 1 ? 'rock' : x === 0 && y === 0 ? 'base' : 'free',
        item: null,
      })),
    );
    expect(result.ok && sortCells(result.map.explored)).toEqual(
      sortCells(expected),
    );
    expect(result).toMatchObject({
      ok: true,
      map: {
        min: -3,
        max: 3,
        robot: { id: 1, x: 1, y: 0 },
        base: { x: 0, y: 0 },
        visionRange: 1,
      },
    });
  });

  it('CA58 — cada robô tem o próprio mapa — RN12', async () => {
    const repository = InMemorySimulationRepository.of(
      Fleet.place(Grid.square(3), starts(2)),
    );
    await play(repository, '1:NN');

    const result = await new DescribeMap(repository).execute(2);

    // O robô 2 continua no canto (-3,3): só 4 casas
    expect(result.ok && result.map.explored).toHaveLength(4);
  });

  it('CA59 — outros robôs aparecem só dentro da visão atual', async () => {
    const repository = InMemorySimulationRepository.of(
      Fleet.place(Grid.square(3), [
        { position: at(0, 0) },
        { position: at(1, 1) },
        { position: at(3, -3) },
      ]),
    );

    const result = await new DescribeMap(repository).execute(1);

    expect(result.ok && result.map.others).toEqual([
      { id: 2, x: 1, y: 1, orientation: 'N' },
    ]);
  });

  it('CA65 — um robô visto antes some do mapa quando sai da visão', async () => {
    const repository = InMemorySimulationRepository.of(
      Fleet.place(Grid.square(3), [
        { position: at(0, 0) },
        { position: at(1, -1) },
      ]),
    );
    await play(repository, '1:NN');

    const result = await new DescribeMap(repository).execute(1);

    // (1,-1) continua no mapa do robô 1, mas ele não vê mais o robô 2 lá
    expect(
      result.ok && result.map.explored.some((c) => c.x === 1 && c.y === -1),
    ).toBe(true);
    expect(result.ok && result.map.others).toEqual([]);
  });

  it('robô inexistente', async () => {
    const repository = new InMemorySimulationRepository();

    expect(await new DescribeMap(repository).execute(2)).toEqual({
      ok: false,
      error: 'UNKNOWN_ROBOT',
      robotId: 2,
    });
  });
});

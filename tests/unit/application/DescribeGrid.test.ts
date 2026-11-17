import { describe, expect, it } from 'vitest';
import { DescribeGrid } from '../../../src/application/use-cases/DescribeGrid.js';
import { MoveRobot } from '../../../src/application/use-cases/MoveRobot.js';
import { Robot } from '../../../src/domain/entities/Robot.js';
import { Grid } from '../../../src/domain/value-objects/Grid.js';
import { Obstacle } from '../../../src/domain/value-objects/Obstacle.js';
import { Position } from '../../../src/domain/value-objects/Position.js';
import { InMemoryRobotRepository } from '../../../src/infrastructure/repositories/InMemoryRobotRepository.js';

const sortCells = <T extends { x: number; y: number }>(cells: T[]): T[] =>
  [...cells].sort((a, b) => a.x - b.x || a.y - b.y);

describe('DescribeGrid', () => {
  const grid = Grid.square(3, [
    Obstacle.create([Position.create(2, 1), Position.create(2, 2)]),
    Obstacle.create([Position.create(-3, 0)]),
  ]);

  it('devolve limites, quantidade de obstáculos e o robô', async () => {
    const repository = new InMemoryRobotRepository(Robot.create(grid));
    await new MoveRobot(repository).execute('DN');

    expect(await new DescribeGrid(repository).execute()).toMatchObject({
      min: -3,
      max: 3,
      obstacleCount: 2,
      robot: { x: 1, y: 0, orientation: 'L' },
    });
  });

  it('expõe só as casas exploradas, marcando os obstáculos vistos — RN12', async () => {
    const repository = new InMemoryRobotRepository(Robot.create(grid));
    await new MoveRobot(repository).execute('L');

    const { explored } = await new DescribeGrid(repository).execute();

    // Visão da origem (x de -1 a 1) + visão de (1,0) (x de 0 a 2), y de -1 a 1
    const expected = [-1, 0, 1, 2].flatMap((x) =>
      [-1, 0, 1].map((y) => ({ x, y, blocked: x === 2 && y === 1 })),
    );
    expect(sortCells(explored)).toEqual(sortCells(expected));
    // O obstáculo em (-3,0) e a parte (2,2) ainda não foram vistos
    expect(explored.some((c) => c.x === -3)).toBe(false);
    expect(explored.some((c) => c.x === 2 && c.y === 2)).toBe(false);
  });
});

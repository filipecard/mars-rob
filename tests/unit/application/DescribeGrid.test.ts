import { describe, expect, it } from 'vitest';
import { DescribeGrid } from '../../../src/application/use-cases/DescribeGrid.js';
import { MoveRobot } from '../../../src/application/use-cases/MoveRobot.js';
import { Robot } from '../../../src/domain/entities/Robot.js';
import { Grid } from '../../../src/domain/value-objects/Grid.js';
import { Obstacle } from '../../../src/domain/value-objects/Obstacle.js';
import { Position } from '../../../src/domain/value-objects/Position.js';
import { InMemoryRobotRepository } from '../../../src/infrastructure/repositories/InMemoryRobotRepository.js';

describe('DescribeGrid', () => {
  it('devolve limites, obstáculos e o estado atual do robô', async () => {
    const grid = Grid.square(3, [
      Obstacle.create([Position.create(1, 1), Position.create(1, 2)]),
    ]);
    const repository = new InMemoryRobotRepository(Robot.create(grid));
    await new MoveRobot(repository).execute('DN');

    expect(await new DescribeGrid(repository).execute()).toEqual({
      min: -3,
      max: 3,
      obstacles: [
        [
          { x: 1, y: 1 },
          { x: 1, y: 2 },
        ],
      ],
      robot: { x: 1, y: 0, orientation: 'L' },
    });
  });
});

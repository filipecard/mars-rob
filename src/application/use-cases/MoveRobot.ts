import { InvalidCommandError } from '../../domain/errors/InvalidCommandError.js';
import { ObstacleError } from '../../domain/errors/ObstacleError.js';
import { OutOfGridError } from '../../domain/errors/OutOfGridError.js';
import { Command } from '../../domain/value-objects/Command.js';
import {
  toPositionDTO,
  toRobotStateDTO,
  type PositionDTO,
  type RobotStateDTO,
} from '../dto.js';
import type { RobotRepository } from '../ports/RobotRepository.js';

export type MoveRobotError = 'INVALID_COMMAND' | 'OUT_OF_GRID' | 'OBSTACLE';

export type MoveRobotResult =
  | { ok: true; robot: RobotStateDTO }
  | {
      ok: false;
      error: 'INVALID_COMMAND' | 'OUT_OF_GRID';
      robot: RobotStateDTO;
    }
  | {
      ok: false;
      error: 'OBSTACLE';
      obstacle: PositionDTO;
      robot: RobotStateDTO;
    };

export class MoveRobot {
  readonly #robots: RobotRepository;

  constructor(robots: RobotRepository) {
    this.#robots = robots;
  }

  async execute(input: string): Promise<MoveRobotResult> {
    const robot = await this.#robots.get();
    try {
      robot.execute(Command.parse(input));
    } catch (error) {
      const state = toRobotStateDTO(robot);
      if (error instanceof InvalidCommandError) {
        return { ok: false, error: 'INVALID_COMMAND', robot: state };
      }
      if (error instanceof OutOfGridError) {
        return { ok: false, error: 'OUT_OF_GRID', robot: state };
      }
      if (error instanceof ObstacleError) {
        return {
          ok: false,
          error: 'OBSTACLE',
          obstacle: toPositionDTO(error.position),
          robot: state,
        };
      }
      throw error;
    }
    await this.#robots.save(robot);
    return { ok: true, robot: toRobotStateDTO(robot) };
  }
}

import type { Robot } from '../../domain/entities/Robot.js';
import { InvalidCommandError } from '../../domain/errors/InvalidCommandError.js';
import { OutOfGridError } from '../../domain/errors/OutOfGridError.js';
import { Command } from '../../domain/value-objects/Command.js';
import type { RobotRepository } from '../ports/RobotRepository.js';

export interface PositionDTO {
  x: number;
  y: number;
}

export type MoveRobotError = 'INVALID_COMMAND' | 'OUT_OF_GRID';

export type MoveRobotResult =
  | { ok: true; position: PositionDTO }
  | { ok: false; error: MoveRobotError; position: PositionDTO };

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
      if (error instanceof InvalidCommandError) {
        return { ok: false, error: 'INVALID_COMMAND', position: toDTO(robot) };
      }
      if (error instanceof OutOfGridError) {
        return { ok: false, error: 'OUT_OF_GRID', position: toDTO(robot) };
      }
      throw error;
    }
    await this.#robots.save(robot);
    return { ok: true, position: toDTO(robot) };
  }
}

function toDTO(robot: Robot): PositionDTO {
  return { x: robot.position.x, y: robot.position.y };
}

import type { Robot } from '../../domain/entities/Robot.js';
import { InvalidCommandError } from '../../domain/errors/InvalidCommandError.js';
import { OutOfGridError } from '../../domain/errors/OutOfGridError.js';
import { Command } from '../../domain/value-objects/Command.js';
import type { RobotRepository } from '../ports/RobotRepository.js';

// Espelha a Orientation do domínio: a apresentação não pode importar o domínio
export type OrientationDTO = 'N' | 'L' | 'S' | 'O';

export interface RobotStateDTO {
  x: number;
  y: number;
  orientation: OrientationDTO;
}

export type MoveRobotError = 'INVALID_COMMAND' | 'OUT_OF_GRID';

export type MoveRobotResult =
  | { ok: true; robot: RobotStateDTO }
  | { ok: false; error: MoveRobotError; robot: RobotStateDTO };

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
        return { ok: false, error: 'INVALID_COMMAND', robot: toDTO(robot) };
      }
      if (error instanceof OutOfGridError) {
        return { ok: false, error: 'OUT_OF_GRID', robot: toDTO(robot) };
      }
      throw error;
    }
    await this.#robots.save(robot);
    return { ok: true, robot: toDTO(robot) };
  }
}

function toDTO(robot: Robot): RobotStateDTO {
  return {
    x: robot.position.x,
    y: robot.position.y,
    orientation: robot.orientation,
  };
}

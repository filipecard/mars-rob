import type { Fleet } from '../../domain/entities/Fleet.js';
import { CollisionError } from '../../domain/errors/CollisionError.js';
import { InvalidCommandError } from '../../domain/errors/InvalidCommandError.js';
import { InvalidOrderError } from '../../domain/errors/InvalidOrderError.js';
import { NotAdjacentError } from '../../domain/errors/NotAdjacentError.js';
import { ObstacleError } from '../../domain/errors/ObstacleError.js';
import { OutOfGridError } from '../../domain/errors/OutOfGridError.js';
import { UnknownRobotError } from '../../domain/errors/UnknownRobotError.js';
import {
  parseOrder,
  splitOrders,
  type MoveOrder,
  type Order,
  type ShareOrder,
} from '../../domain/value-objects/Order.js';
import {
  toPositionDTO,
  toRobotStateDTO,
  type PositionDTO,
  type RobotStateDTO,
} from '../dto.js';
import type { FleetRepository } from '../ports/FleetRepository.js';

export type OrderResult =
  | { ok: true; kind: 'move'; robot: RobotStateDTO }
  | { ok: true; kind: 'share'; from: number; to: number; added: number }
  | { ok: false; error: 'INVALID_ORDER' | 'INVALID_COMMAND'; input: string }
  | { ok: false; error: 'UNKNOWN_ROBOT'; robotId: number }
  | { ok: false; error: 'OUT_OF_GRID'; robot: RobotStateDTO }
  | {
      ok: false;
      error: 'OBSTACLE';
      obstacle: PositionDTO;
      robot: RobotStateDTO;
    }
  | {
      ok: false;
      error: 'COLLISION';
      other: number;
      at: PositionDTO;
      robot: RobotStateDTO;
    }
  | { ok: false; error: 'NOT_ADJACENT'; from: number; to: number };

// RN14: executa as ordens de uma linha em sequência. Cada ordem é independente:
// uma ordem rejeitada não desfaz as anteriores nem impede as seguintes.
export class ExecuteOrders {
  readonly #fleets: FleetRepository;

  constructor(fleets: FleetRepository) {
    this.#fleets = fleets;
  }

  async execute(line: string): Promise<OrderResult[]> {
    const fleet = await this.#fleets.get();
    const results = splitOrders(line).map((input) => run(fleet, input));
    await this.#fleets.save(fleet);
    return results;
  }
}

function run(fleet: Fleet, input: string): OrderResult {
  let order: Order;
  try {
    order = parseOrder(input);
  } catch (error) {
    if (error instanceof InvalidOrderError) {
      return { ok: false, error: 'INVALID_ORDER', input };
    }
    if (error instanceof InvalidCommandError) {
      return { ok: false, error: 'INVALID_COMMAND', input };
    }
    throw error;
  }
  try {
    return order.kind === 'move' ? move(fleet, order) : share(fleet, order);
  } catch (error) {
    if (error instanceof UnknownRobotError) {
      return { ok: false, error: 'UNKNOWN_ROBOT', robotId: error.robotId };
    }
    throw error;
  }
}

function move(fleet: Fleet, { robotId, command }: MoveOrder): OrderResult {
  const robot = fleet.robot(robotId);
  try {
    fleet.move(robotId, command);
  } catch (error) {
    const state = toRobotStateDTO(robotId, robot);
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
    if (error instanceof CollisionError) {
      return {
        ok: false,
        error: 'COLLISION',
        other: error.robotId,
        at: toPositionDTO(error.position),
        robot: state,
      };
    }
    throw error;
  }
  return { ok: true, kind: 'move', robot: toRobotStateDTO(robotId, robot) };
}

function share(fleet: Fleet, { from, to }: ShareOrder): OrderResult {
  try {
    return {
      ok: true,
      kind: 'share',
      from,
      to,
      added: fleet.shareMap(from, to),
    };
  } catch (error) {
    if (error instanceof NotAdjacentError) {
      return { ok: false, error: 'NOT_ADJACENT', from, to };
    }
    throw error;
  }
}

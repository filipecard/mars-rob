import { InvalidCommandError } from '../../domain/errors/InvalidCommandError.js';
import { InvalidOrderError } from '../../domain/errors/InvalidOrderError.js';
import { UnknownRobotError } from '../../domain/errors/UnknownRobotError.js';
import type { Action } from '../../domain/script/host.js';
import { actionsOf } from '../../domain/simulation/Program.js';
import type { Simulation } from '../../domain/simulation/Simulation.js';
import {
  parseOrder,
  splitOrders,
  type Order,
} from '../../domain/value-objects/Order.js';
import type { SimulationRepository } from '../ports/SimulationRepository.js';

// Uma ordem aceita só entra na fila do robô: quem a executa é o relógio (AdvanceClock)
export type OrderResult =
  | { ok: true; input: string; robotId: number }
  | { ok: false; error: 'INVALID_ORDER' | 'INVALID_COMMAND'; input: string }
  | { ok: false; error: 'UNKNOWN_ROBOT'; input: string; robotId: number };

// RN14/RN17: as ordens de uma linha entram, na ordem, na fila de cada robô.
// Uma ordem rejeitada não impede as outras.
export class ExecuteOrders {
  readonly #simulations: SimulationRepository;

  constructor(simulations: SimulationRepository) {
    this.#simulations = simulations;
  }

  async execute(line: string): Promise<OrderResult[]> {
    const simulation = await this.#simulations.get();
    const results = splitOrders(line).map((input) => give(simulation, input));
    await this.#simulations.save(simulation);
    return results;
  }
}

function give(simulation: Simulation, input: string): OrderResult {
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
  const robotId = order.kind === 'move' ? order.robotId : order.from;
  const actions: Action[] =
    order.kind === 'move'
      ? actionsOf(order.command)
      : [{ kind: 'shareMap', to: order.to }];
  try {
    if (order.kind === 'share') {
      simulation.fleet.robot(order.to);
    }
    simulation.giveOrder(robotId, actions);
  } catch (error) {
    if (error instanceof UnknownRobotError) {
      return {
        ok: false,
        error: 'UNKNOWN_ROBOT',
        input,
        robotId: error.robotId,
      };
    }
    throw error;
  }
  return { ok: true, input, robotId };
}

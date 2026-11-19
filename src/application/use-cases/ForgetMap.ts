import { UnknownRobotError } from '../../domain/errors/UnknownRobotError.js';
import type { SimulationRepository } from '../ports/SimulationRepository.js';

export type ForgetMapResult =
  | { ok: true; forgotten: number }
  | { ok: false; error: 'UNKNOWN_ROBOT'; robotId: number };

// RN20: o operador apaga o mapa de um robô (não gasta tick nem para o programa)
export class ForgetMap {
  readonly #simulations: SimulationRepository;

  constructor(simulations: SimulationRepository) {
    this.#simulations = simulations;
  }

  async execute(robotId: number): Promise<ForgetMapResult> {
    const simulation = await this.#simulations.get();
    try {
      const forgotten = simulation.forgetMap(robotId);
      await this.#simulations.save(simulation);
      return { ok: true, forgotten };
    } catch (error) {
      if (error instanceof UnknownRobotError) {
        return { ok: false, error: 'UNKNOWN_ROBOT', robotId };
      }
      throw error;
    }
  }
}

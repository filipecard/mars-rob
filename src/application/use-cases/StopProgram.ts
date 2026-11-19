import { UnknownRobotError } from '../../domain/errors/UnknownRobotError.js';
import type { SimulationRepository } from '../ports/SimulationRepository.js';

export type StopProgramResult =
  | { ok: true; stopped: boolean }
  | { ok: false; error: 'UNKNOWN_ROBOT'; robotId: number };

// RN17: encerra o programa (ordens ou script) de um robô
export class StopProgram {
  readonly #simulations: SimulationRepository;

  constructor(simulations: SimulationRepository) {
    this.#simulations = simulations;
  }

  async execute(robotId: number): Promise<StopProgramResult> {
    const simulation = await this.#simulations.get();
    try {
      const stopped = simulation.stop(robotId);
      await this.#simulations.save(simulation);
      return { ok: true, stopped };
    } catch (error) {
      if (error instanceof UnknownRobotError) {
        return { ok: false, error: 'UNKNOWN_ROBOT', robotId };
      }
      throw error;
    }
  }
}

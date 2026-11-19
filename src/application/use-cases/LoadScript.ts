import { ScriptSyntaxError } from '../../domain/script/ScriptError.js';
import { UnknownRobotError } from '../../domain/errors/UnknownRobotError.js';
import type { SimulationRepository } from '../ports/SimulationRepository.js';

export type LoadScriptResult =
  | { ok: true }
  | {
      ok: false;
      error: 'SYNTAX';
      message: string;
      line: number;
      column: number;
    }
  | { ok: false; error: 'UNKNOWN_ROBOT'; robotId: number };

// RN18: carrega um script no robô. Ele roda nos próximos ticks (AdvanceClock).
export class LoadScript {
  readonly #simulations: SimulationRepository;

  constructor(simulations: SimulationRepository) {
    this.#simulations = simulations;
  }

  async execute(robotId: number, source: string): Promise<LoadScriptResult> {
    const simulation = await this.#simulations.get();
    try {
      simulation.loadScript(robotId, source);
    } catch (error) {
      if (error instanceof UnknownRobotError) {
        return { ok: false, error: 'UNKNOWN_ROBOT', robotId };
      }
      if (error instanceof ScriptSyntaxError) {
        return {
          ok: false,
          error: 'SYNTAX',
          message: error.reason,
          ...error.location,
        };
      }
      throw error;
    }
    await this.#simulations.save(simulation);
    return { ok: true };
  }
}

import { UnknownRobotError } from '../../domain/errors/UnknownRobotError.js';
import { toMapDTO, type MapDTO } from '../dto.js';
import type { SimulationRepository } from '../ports/SimulationRepository.js';

export type DescribeMapResult =
  | { ok: true; map: MapDTO }
  | { ok: false; error: 'UNKNOWN_ROBOT'; robotId: number };

// RN12: o mapa de um robô, para a apresentação desenhar
export class DescribeMap {
  readonly #simulations: SimulationRepository;

  constructor(simulations: SimulationRepository) {
    this.#simulations = simulations;
  }

  async execute(robotId: number): Promise<DescribeMapResult> {
    const fleet = (await this.#simulations.get()).fleet;
    try {
      return { ok: true, map: toMapDTO(fleet, robotId) };
    } catch (error) {
      if (error instanceof UnknownRobotError) {
        return { ok: false, error: 'UNKNOWN_ROBOT', robotId };
      }
      throw error;
    }
  }
}

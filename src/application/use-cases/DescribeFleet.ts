import { toFleetDTO, type FleetDTO } from '../dto.js';
import type { SimulationRepository } from '../ports/SimulationRepository.js';

// Resumo da malha: limites, quantos obstáculos e quantos robôs
export class DescribeFleet {
  readonly #simulations: SimulationRepository;

  constructor(simulations: SimulationRepository) {
    this.#simulations = simulations;
  }

  async execute(): Promise<FleetDTO> {
    return toFleetDTO((await this.#simulations.get()).fleet);
  }
}

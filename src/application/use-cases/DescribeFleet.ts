import { toFleetDTO, type FleetDTO } from '../dto.js';
import type { FleetRepository } from '../ports/FleetRepository.js';

// Resumo da malha: limites, quantos obstáculos e quantos robôs
export class DescribeFleet {
  readonly #fleets: FleetRepository;

  constructor(fleets: FleetRepository) {
    this.#fleets = fleets;
  }

  async execute(): Promise<FleetDTO> {
    return toFleetDTO(await this.#fleets.get());
  }
}

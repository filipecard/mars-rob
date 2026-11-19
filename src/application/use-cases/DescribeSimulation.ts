import { toSimulationDTO, type SimulationDTO } from '../dto.js';
import type { SimulationRepository } from '../ports/SimulationRepository.js';

// O estado inteiro, para o frontend: relógio, malha, programas e o mapa de cada robô
export class DescribeSimulation {
  readonly #simulations: SimulationRepository;

  constructor(simulations: SimulationRepository) {
    this.#simulations = simulations;
  }

  async execute(): Promise<SimulationDTO> {
    return toSimulationDTO(await this.#simulations.get());
  }
}

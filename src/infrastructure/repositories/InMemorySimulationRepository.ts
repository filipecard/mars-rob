import type { SimulationRepository } from '../../application/ports/SimulationRepository.js';
import { Fleet } from '../../domain/entities/Fleet.js';
import { Simulation } from '../../domain/simulation/Simulation.js';
import { Grid } from '../../domain/value-objects/Grid.js';

export class InMemorySimulationRepository implements SimulationRepository {
  #simulation: Simulation;

  constructor(
    simulation: Simulation = new Simulation(
      Fleet.create(Grid.standard(), 1, Math.random),
    ),
  ) {
    this.#simulation = simulation;
  }

  // Atalho: uma simulação nova para a frota
  static of(fleet: Fleet): InMemorySimulationRepository {
    return new InMemorySimulationRepository(new Simulation(fleet));
  }

  get(): Promise<Simulation> {
    return Promise.resolve(this.#simulation);
  }

  save(simulation: Simulation): Promise<void> {
    this.#simulation = simulation;
    return Promise.resolve();
  }
}

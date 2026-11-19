import type { Simulation } from '../../domain/simulation/Simulation.js';

export interface SimulationRepository {
  get(): Promise<Simulation>;
  save(simulation: Simulation): Promise<void>;
}

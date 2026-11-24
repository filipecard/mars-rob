import type { SimulationSnapshot } from '../../domain/simulation/Simulation.js';

// RN30: onde as simulações salvas ficam guardadas (arquivos, banco...)
export interface SaveStore {
  save(name: string, snapshot: SimulationSnapshot): Promise<void>;
  // null: não existe. O conteúdo ainda não foi validado.
  load(name: string): Promise<unknown>;
  list(): Promise<string[]>;
}

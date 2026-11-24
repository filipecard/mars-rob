import type { SaveStore } from '../../../src/application/ports/SaveStore.js';
import type { SimulationSnapshot } from '../../../src/domain/simulation/Simulation.js';

// Saves em memória, para testar sem disco. Passa pelo JSON para pegar o que não serializa.
export class MemorySaveStore implements SaveStore {
  readonly files = new Map<string, string>();

  save(name: string, snapshot: SimulationSnapshot): Promise<void> {
    this.files.set(name, JSON.stringify(snapshot));
    return Promise.resolve();
  }

  load(name: string): Promise<unknown> {
    const text = this.files.get(name);
    return Promise.resolve(
      text === undefined ? null : (JSON.parse(text) as unknown),
    );
  }

  list(): Promise<string[]> {
    return Promise.resolve([...this.files.keys()].sort());
  }
}

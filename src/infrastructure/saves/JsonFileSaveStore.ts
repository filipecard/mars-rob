import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SaveStore } from '../../application/ports/SaveStore.js';
import type { SimulationSnapshot } from '../../domain/simulation/Simulation.js';

export const DEFAULT_SAVES_DIR = 'saves';

// RN30: cada simulação salva vira um arquivo <nome>.json na pasta
export class JsonFileSaveStore implements SaveStore {
  readonly #dir: string;

  constructor(dir: string = DEFAULT_SAVES_DIR) {
    this.#dir = dir;
  }

  async save(name: string, snapshot: SimulationSnapshot): Promise<void> {
    await mkdir(this.#dir, { recursive: true });
    await writeFile(this.#path(name), JSON.stringify(snapshot), 'utf8');
  }

  async load(name: string): Promise<unknown> {
    let text: string;
    try {
      text = await readFile(this.#path(name), 'utf8');
    } catch (error) {
      if (isMissing(error)) {
        return null;
      }
      throw error;
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      // Arquivo estragado: o caso de uso recusa como save inválido
      return {};
    }
  }

  async list(): Promise<string[]> {
    try {
      const files = await readdir(this.#dir);
      return files
        .filter((file) => file.endsWith('.json'))
        .map((file) => file.slice(0, -'.json'.length))
        .sort();
    } catch (error) {
      if (isMissing(error)) {
        return [];
      }
      throw error;
    }
  }

  #path(name: string): string {
    return join(this.#dir, `${name}.json`);
  }
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

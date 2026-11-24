import type { Random } from '../../domain/services/random.js';
import {
  Simulation,
  type SimulationSnapshot,
} from '../../domain/simulation/Simulation.js';
import type { SaveStore } from '../ports/SaveStore.js';
import type { SimulationRepository } from '../ports/SimulationRepository.js';

// RN30: letras sem acento, números, _ e -, até 40
export const SAVE_NAME = /^[A-Za-z0-9_-]{1,40}$/;

export type SaveResult =
  | { ok: true; name: string; tick: number }
  | { ok: false; error: 'INVALID_NAME'; name: string };

export type LoadResult =
  | { ok: true; name: string; tick: number }
  | {
      ok: false;
      error: 'INVALID_NAME' | 'NOT_FOUND' | 'INVALID_SAVE';
      name: string;
    };

// RN30: salva a simulação inteira (mundo, robôs, mapas e scripts que estão rodando)
export class SaveGame {
  readonly #simulations: SimulationRepository;
  readonly #store: SaveStore;

  constructor(simulations: SimulationRepository, store: SaveStore) {
    this.#simulations = simulations;
    this.#store = store;
  }

  async execute(name: string): Promise<SaveResult> {
    if (!SAVE_NAME.test(name)) {
      return { ok: false, error: 'INVALID_NAME', name };
    }
    const simulation = await this.#simulations.get();
    await this.#store.save(name, simulation.snapshot());
    return { ok: true, name, tick: simulation.tick };
  }
}

// RN30: troca a simulação atual pela salva. Os scripts recomeçam do início e as
// ordens diretas que estavam na fila se perdem.
export class LoadGame {
  readonly #simulations: SimulationRepository;
  readonly #store: SaveStore;
  readonly #randomFor: (seed: number) => Random;

  constructor(
    simulations: SimulationRepository,
    store: SaveStore,
    randomFor: (seed: number) => Random,
  ) {
    this.#simulations = simulations;
    this.#store = store;
    this.#randomFor = randomFor;
  }

  async execute(name: string): Promise<LoadResult> {
    if (!SAVE_NAME.test(name)) {
      return { ok: false, error: 'INVALID_NAME', name };
    }
    const raw = await this.#store.load(name);
    if (raw === null) {
      return { ok: false, error: 'NOT_FOUND', name };
    }
    let simulation: Simulation;
    try {
      const snapshot = raw as SimulationSnapshot;
      if ((snapshot as { version?: unknown }).version !== 1) {
        return { ok: false, error: 'INVALID_SAVE', name };
      }
      // O mundo volta a sortear a partir de semente + tick: carregar o mesmo jogo
      // duas vezes dá o mesmo resultado
      const seed = ((snapshot.seed ?? 0) + snapshot.tick) >>> 0;
      simulation = Simulation.restore(snapshot, this.#randomFor(seed));
    } catch {
      return { ok: false, error: 'INVALID_SAVE', name };
    }
    await this.#simulations.save(simulation);
    return { ok: true, name, tick: simulation.tick };
  }
}

export class ListSaves {
  readonly #store: SaveStore;

  constructor(store: SaveStore) {
    this.#store = store;
  }

  execute(): Promise<string[]> {
    return this.#store.list();
  }
}

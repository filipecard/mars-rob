import { describe, expect, it } from 'vitest';
import {
  ListSaves,
  LoadGame,
  SaveGame,
} from '../../../src/application/use-cases/SaveGame.js';
import { Fleet } from '../../../src/domain/entities/Fleet.js';
import { Simulation } from '../../../src/domain/simulation/Simulation.js';
import { Grid } from '../../../src/domain/value-objects/Grid.js';
import { World } from '../../../src/domain/world/World.js';
import { MemorySaveStore } from './MemorySaveStore.js';

function repository(): {
  get: () => Promise<Simulation>;
  save: (simulation: Simulation) => Promise<void>;
  current: Simulation;
} {
  const world = World.create(Grid.square(3));
  const current = new Simulation(
    Fleet.create(world, 1, () => 0.5),
    { seed: 7 },
  );
  return {
    current,
    get: () => Promise.resolve(current),
    save: () => Promise.resolve(),
  };
}

describe('SaveGame', () => {
  it('recusa nomes fora do formato', async () => {
    const repo = repository();
    const store = new MemorySaveStore();
    expect(await new SaveGame(repo, store).execute('../bad')).toEqual({
      ok: false,
      error: 'INVALID_NAME',
      name: '../bad',
    });
    expect(store.files.size).toBe(0);
  });

  it('salva o snapshot e lista os nomes em ordem', async () => {
    const repo = repository();
    const store = new MemorySaveStore();
    expect(await new SaveGame(repo, store).execute('mars-1')).toEqual({
      ok: true,
      name: 'mars-1',
      tick: 0,
    });
    await store.save('alpha', repo.current.snapshot());
    expect(await new ListSaves(store).execute()).toEqual(['alpha', 'mars-1']);
  });

  it('carrega snapshot válido e recusa nome inválido, ausente ou corrompido', async () => {
    const repo = repository();
    const store = new MemorySaveStore();
    const loader = new LoadGame(repo, store, () => () => 0.5);
    expect(await loader.execute('bad/name')).toMatchObject({
      error: 'INVALID_NAME',
    });
    expect(await loader.execute('missing')).toMatchObject({
      error: 'NOT_FOUND',
    });
    store.files.set('broken', JSON.stringify({}));
    expect(await loader.execute('broken')).toMatchObject({
      error: 'INVALID_SAVE',
    });
    store.files.set('wrong-version', JSON.stringify({ version: 2 }));
    expect(await loader.execute('wrong-version')).toMatchObject({
      error: 'INVALID_SAVE',
    });
    store.files.set('invalid-state', JSON.stringify({ version: 1 }));
    expect(await loader.execute('invalid-state')).toMatchObject({
      error: 'INVALID_SAVE',
    });

    await new SaveGame(repo, store).execute('valid');
    expect(await loader.execute('valid')).toEqual({
      ok: true,
      name: 'valid',
      tick: 0,
    });
  });
});

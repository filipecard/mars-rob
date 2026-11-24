import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Fleet } from '../../../src/domain/entities/Fleet.js';
import { Simulation } from '../../../src/domain/simulation/Simulation.js';
import { Grid } from '../../../src/domain/value-objects/Grid.js';
import { World } from '../../../src/domain/world/World.js';
import { JsonFileSaveStore } from '../../../src/infrastructure/saves/JsonFileSaveStore.js';

const folders: string[] = [];

async function folder(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'mars-rob-saves-'));
  folders.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(
    folders.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe('JsonFileSaveStore', () => {
  it('lista pasta vazia, salva, carrega e ordena arquivos JSON', async () => {
    const path = await folder();
    const store = new JsonFileSaveStore(join(path, 'saves'));
    expect(await store.list()).toEqual([]);
    expect(await store.load('missing')).toBeNull();
    const world = World.create(Grid.square(2));
    const snapshot = new Simulation(
      Fleet.create(world, 1, () => 0.5),
    ).snapshot();
    await store.save('zeta', snapshot);
    await store.save('alpha', snapshot);
    expect(await store.load('alpha')).toEqual(snapshot);
    expect(await store.list()).toEqual(['alpha', 'zeta']);
  });

  it('trata conteúdo JSON corrompido como save inválido', async () => {
    const path = await folder();
    const store = new JsonFileSaveStore(path);
    await writeFile(join(path, 'broken.json'), '{', 'utf8');
    expect(await store.load('broken')).toEqual({});
    await writeFile(join(path, 'ignored.txt'), 'x', 'utf8');
    expect(await store.list()).toEqual(['broken']);
  });
});

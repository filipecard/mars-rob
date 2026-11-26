import { describe, expect, it } from 'vitest';
import { Grid } from '../../../../src/domain/value-objects/Grid.js';
import { Obstacle } from '../../../../src/domain/value-objects/Obstacle.js';
import { Position } from '../../../../src/domain/value-objects/Position.js';
import {
  STATIC_WORLD_SETTINGS,
  World,
  type WorldSettings,
} from '../../../../src/domain/world/World.js';
import { seededRandom } from '../../../../src/infrastructure/random/seededRandom.js';

const at = (x: number, y: number): Position => Position.create(x, y);
const nobody = (): boolean => false;

// Mundo sem nada nascendo sozinho, com os ajustes pedidos
function world(
  settings: Partial<WorldSettings> = {},
  grid: Grid = Grid.square(5),
): World {
  return World.create(
    grid,
    { ...STATIC_WORLD_SETTINGS, ...settings },
    seededRandom(7),
  );
}

function run(target: World, ticks: number, isOccupied = nobody): void {
  for (let i = 0; i < ticks; i++) {
    target.advance(isOccupied);
  }
}

describe('World — base e chão — RN23', () => {
  it('a base fica na origem, é livre e aparece como base', () => {
    const w = World.of(Grid.square(3, [Obstacle.create([at(2, 2)])]));

    expect(w.base).toEqual(at(0, 0));
    expect(w.isBase(at(0, 0))).toBe(true);
    expect(w.isBlocked(at(0, 0))).toBe(false);
    expect(w.describe(at(0, 0))).toEqual({ ground: 'base', item: null });
    expect(w.describe(at(2, 2))).toEqual({ ground: 'rock', item: null });
    expect(w.describe(at(1, 2))).toEqual({ ground: 'free', item: null });
    expect(w.warehouse.capacity).toBe(50);
  });

  it('o armazém cresce 50 a cada nível — RN28', () => {
    const w = World.of(Grid.square(3));
    w.upgradeWarehouse();

    expect(w.warehouseLevel).toBe(1);
    expect(w.warehouse.capacity).toBe(100);
  });
});

describe('World — itens — RN25', () => {
  it('põe e tira itens só em casa livre e vazia', () => {
    const w = world();
    w.plantTree([at(3, 3)]);

    expect(w.placeItem(at(2, 2), 'stone')).toBe(true);
    expect(w.placeItem(at(2, 2), 'branch')).toBe(false);
    expect(w.placeItem(at(3, 3), 'branch')).toBe(false);
    expect(w.placeItem(at(9, 9), 'branch')).toBe(false);
    expect(w.describe(at(2, 2))).toEqual({ ground: 'free', item: 'stone' });
    expect(w.takeItem(at(2, 2))).toBe('stone');
    expect(w.takeItem(at(2, 2))).toBeNull();
    expect(w.itemCount).toBe(0);
  });
});

describe('World — árvores — RN26', () => {
  it('a árvore bloqueia a casa e cresce 1 casa a cada N ticks, até o máximo', () => {
    const w = world({ treeGrowEvery: 2, treeMaxCells: 3 });
    w.plantTree([at(3, 3)]);

    expect(w.isBlocked(at(3, 3))).toBe(true);
    expect(w.describe(at(3, 3)).ground).toBe('tree');
    run(w, 2);
    expect(blockedAround(w, at(3, 3))).toBe(2);
    run(w, 2);
    expect(blockedAround(w, at(3, 3))).toBe(3);
    run(w, 10);
    expect(blockedAround(w, at(3, 3))).toBe(3);
  });

  it('não cresce em cima de robô', () => {
    const w = world({ treeGrowEvery: 1, treeMaxCells: 5 });
    w.plantTree([at(3, 3)]);

    run(w, 5, () => true);

    expect(blockedAround(w, at(3, 3))).toBe(1);
  });

  it('árvore com 3 casas ou mais solta galhos em volta', () => {
    const w = world({ branchEvery: 1 });
    w.plantTree([at(3, 3), at(3, 4), at(4, 3)]);

    run(w, 3);

    expect(w.itemCount).toBe(2);
    for (let x = -5; x <= 5; x++) {
      for (let y = -5; y <= 5; y++) {
        const item = w.itemAt(at(x, y));
        if (item !== null) {
          expect(item).toBe('branch');
          expect(Math.abs(x - 3) <= 2 && Math.abs(y - 3) <= 2).toBe(true);
        }
      }
    }
  });

  it('a árvore não cai pelo tempo; só sai com uma ação explícita de corte', () => {
    const w = world();
    w.plantTree([at(3, 3), at(3, 4)], 2);

    run(w, 1);
    expect(w.treeCount).toBe(1);
    run(w, 1);

    expect(w.treeCount).toBe(0);
    expect(w.isBlocked(at(3, 3))).toBe(false);
    expect(w.describe(at(3, 3))).toEqual({ ground: 'free', item: 'log' });
    expect(w.itemAt(at(3, 4))).toBe('log');
  });

  it('nascem árvores novas, até o máximo', () => {
    const w = world({ treeEvery: 1, maxTrees: 2, treeLifespan: 50 });

    run(w, 10);

    expect(w.treeCount).toBe(2);
  });

  it('não planta perto da base, nos cantos nem isolando parte da malha — RN11', () => {
    const w = world();

    expect(() => {
      w.plantTree([at(1, 1)]);
    }).toThrow(RangeError);
    expect(() => {
      w.plantTree([at(5, 5)]);
    }).toThrow(RangeError);
    // fechar a casa (5,4) entre o canto e as árvores isolaria o canto (5,5)
    w.plantTree([at(4, 5)]);
    expect(() => {
      w.plantTree([at(5, 4)]);
    }).toThrow(RangeError);
  });
});

describe('World — jazidas — RN27', () => {
  it('nascem encostadas nas rochas', () => {
    const w = world(
      { oreEvery: 1, maxOres: 1 },
      Grid.square(5, [Obstacle.create([at(3, 3)])]),
    );

    run(w, 3);

    expect(w.oreCount).toBe(1);
    const ores = [at(3, 4), at(3, 2), at(4, 3), at(2, 3)].filter((cell) =>
      w.isOre(cell),
    );
    expect(ores).toHaveLength(1);
  });

  it('cada mineração tira 1 ferro; quando acaba, vira casa livre com uma pedra', () => {
    const w = world();
    w.addOre(at(3, 3), 2);

    expect(w.mine(at(3, 3))).toEqual({ item: 'iron', depleted: false });
    expect(w.mine(at(3, 3))).toEqual({ item: 'iron', depleted: true });
    expect(w.isOre(at(3, 3))).toBe(false);
    expect(w.describe(at(3, 3))).toEqual({ ground: 'free', item: 'stone' });
    expect(w.mine(at(3, 3))).toBeNull();
  });

  it('não põe jazida perto da base', () => {
    expect(() => {
      world().addOre(at(0, 1));
    }).toThrow(RangeError);
  });
});

describe('World — criação e snapshot', () => {
  it('espalha pedras, árvores e jazidas; a base e o 3x3 em volta ficam livres', () => {
    const grid = Grid.square(10, [Obstacle.create([at(5, 5), at(5, 6)])]);
    const w = World.create(
      grid,
      {
        ...STATIC_WORLD_SETTINGS,
        stones: 8,
        initialTrees: 3,
        initialOres: 2,
        treeMaxCells: 4,
        treeLifespan: 100,
      },
      seededRandom(3),
    );

    expect(w.itemCount).toBe(8);
    expect(w.treeCount).toBe(3);
    expect(w.oreCount).toBe(2);
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        expect(w.isBlocked(at(x, y))).toBe(false);
        expect(w.itemAt(at(x, y))).toBeNull();
      }
    }
  });

  it('o snapshot volta ao mesmo mundo — RN30', () => {
    const w = world({ stones: 4, initialTrees: 2, treeLifespan: 30 });
    w.addOre(at(-4, -4), 2);
    w.warehouse.add('log');
    w.upgradeWarehouse();

    const restored = World.restore(
      JSON.parse(JSON.stringify(w.snapshot())) as ReturnType<World['snapshot']>,
      seededRandom(1),
    );

    expect(restored.snapshot()).toEqual(w.snapshot());
    expect(restored.warehouse.capacity).toBe(100);
  });
});

// Quantas casas bloqueadas há no 5x5 em volta
function blockedAround(w: World, center: Position): number {
  let count = 0;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      if (w.isBlocked(center.translate(dx, dy))) {
        count++;
      }
    }
  }
  return count;
}

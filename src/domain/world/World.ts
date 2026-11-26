import { shuffle, type Random } from '../services/random.js';
import { allFreeCellsConnected, corners, Grid } from '../value-objects/Grid.js';
import { keyOf, Obstacle, sideNeighbors } from '../value-objects/Obstacle.js';
import { Position } from '../value-objects/Position.js';
import { Inventory } from './Inventory.js';
import type { ItemCounts, ItemKind } from './Item.js';
import type { CellSnapshot, Ground, Terrain } from './Terrain.js';
import { WAREHOUSE_PER_LEVEL } from './Upgrade.js';

// RN23, RN26, RN27: números do mundo. "Every" e "lifespan" iguais a 0 querem dizer "nunca".
export interface WorldSettings {
  // Pedras soltas no chão quando o mundo nasce
  stones: number;
  initialTrees: number;
  initialOres: number;
  // Em média, uma árvore (ou jazida) nova a cada N ticks
  treeEvery: number;
  oreEvery: number;
  maxTrees: number;
  maxOres: number;
  // A árvore ganha uma casa a cada N ticks, até treeMaxCells
  treeGrowEvery: number;
  treeMaxCells: number;
  // Árvore com 3 casas ou mais solta um galho em volta a cada N ticks
  branchEvery: number;
  // Ticks até a árvore cair (cada árvore vive entre 1x e 1,5x isso)
  treeLifespan: number;
  // Quantas vezes uma jazida pode ser minerada
  oreUses: number;
  // Capacidade inicial do armazém da base
  warehouse: number;
}

export const DEFAULT_WORLD_SETTINGS: WorldSettings = {
  stones: 40,
  initialTrees: 10,
  initialOres: 6,
  treeEvery: 40,
  oreEvery: 80,
  maxTrees: 20,
  maxOres: 10,
  treeGrowEvery: 30,
  treeMaxCells: 5,
  branchEvery: 40,
  treeLifespan: 400,
  oreUses: 3,
  warehouse: 50,
};

// Mundo parado: só a malha e a base (usado quando a frota recebe uma Grid pronta)
export const STATIC_WORLD_SETTINGS: WorldSettings = {
  stones: 0,
  initialTrees: 0,
  initialOres: 0,
  treeEvery: 0,
  oreEvery: 0,
  maxTrees: 0,
  maxOres: 0,
  treeGrowEvery: 0,
  treeMaxCells: 1,
  branchEvery: 0,
  treeLifespan: 0,
  oreUses: 3,
  warehouse: 50,
};

const PLACEMENT_ATTEMPTS = 30;

interface Tree {
  cells: Position[];
  age: number;
  // 0: não cai
  lifespan: number;
}

interface Ore {
  position: Position;
  remaining: number;
}

export interface MineResult {
  item: ItemKind;
  // A jazida acabou (e deixou uma pedra no lugar)
  depleted: boolean;
}

// Para salvar e carregar (RN30)
export interface WorldSnapshot {
  grid: { min: number; max: number; obstacles: [number, number][][] };
  settings: WorldSettings;
  trees: { cells: [number, number][]; age: number; lifespan: number }[];
  ores: { x: number; y: number; remaining: number }[];
  items: { x: number; y: number; item: ItemKind }[];
  warehouse: ItemCounts;
  warehouseLevel: number;
  specialGround?: { x: number; y: number; ground: 'sand' | 'ice' }[];
}

// RN23–RN27: o mundo vivo sobre a malha fixa (as rochas). Tem a base, os itens no
// chão, as árvores e as jazidas, que mudam a cada tick. Implementa Terrain: é por
// ele que os robôs sabem o que bloqueia o caminho.
export class World implements Terrain {
  readonly grid: Grid;
  readonly settings: WorldSettings;
  // RN23: a base fica na origem
  readonly base = Position.origin();
  readonly warehouse: Inventory;
  readonly #random: Random;
  readonly #trees = new Set<Tree>();
  readonly #treeAt = new Map<string, Tree>();
  readonly #ores = new Map<string, Ore>();
  readonly #items = new Map<string, ItemKind>();
  readonly #specialGround = new Map<string, 'sand' | 'ice'>();
  #warehouseLevel = 0;

  private constructor(grid: Grid, settings: WorldSettings, random: Random) {
    this.grid = grid;
    this.settings = settings;
    this.#random = random;
    this.warehouse = new Inventory(settings.warehouse);
  }

  // Mundo novo: espalha as pedras, as árvores e as jazidas iniciais
  static create(
    grid: Grid,
    settings: WorldSettings = DEFAULT_WORLD_SETTINGS,
    random: Random = Math.random,
  ): World {
    const world = new World(grid, settings, random);
    world.#populate();
    return world;
  }

  // Mundo parado sobre uma malha pronta
  static of(grid: Grid): World {
    return new World(grid, STATIC_WORLD_SETTINGS, Math.random);
  }

  static restore(snapshot: WorldSnapshot, random: Random): World {
    const { min, max, obstacles } = snapshot.grid;
    const grid = Grid.create(
      min,
      max,
      obstacles.map((cells) => Obstacle.create(cells.map(toPosition))),
    );
    const world = new World(grid, snapshot.settings, random);
    for (const tree of snapshot.trees) {
      world.#addTree({
        cells: tree.cells.map(toPosition),
        age: tree.age,
        lifespan: tree.lifespan,
      });
    }
    for (const { x, y, remaining } of snapshot.ores) {
      const position = Position.create(x, y);
      world.#ores.set(keyOf(position), { position, remaining });
    }
    for (const { x, y, item } of snapshot.items) {
      world.#items.set(keyOf({ x, y }), item);
    }
    for (const { x, y, ground } of snapshot.specialGround ?? []) world.#specialGround.set(keyOf({ x, y }), ground);
    for (let level = 0; level < snapshot.warehouseLevel; level++) {
      world.upgradeWarehouse();
    }
    for (const [item, count] of Object.entries(snapshot.warehouse)) {
      for (let i = 0; i < count; i++) {
        world.warehouse.add(item as ItemKind);
      }
    }
    return world;
  }

  snapshot(): WorldSnapshot {
    return {
      grid: {
        min: this.grid.min,
        max: this.grid.max,
        obstacles: this.grid.obstacles.map((obstacle) =>
          obstacle.cells.map(toPair),
        ),
      },
      settings: this.settings,
      trees: [...this.#trees].map(({ cells, age, lifespan }) => ({
        cells: cells.map(toPair),
        age,
        lifespan,
      })),
      ores: [...this.#ores.values()].map(({ position, remaining }) => ({
        x: position.x,
        y: position.y,
        remaining,
      })),
      items: [...this.#items].map(([key, item]) => {
        const [x = 0, y = 0] = key.split(',').map(Number);
        return { x, y, item };
      }),
      warehouse: this.warehouse.counts(),
      warehouseLevel: this.#warehouseLevel,
      specialGround: [...this.#specialGround].map(([key, ground]) => { const [x = 0, y = 0] = key.split(',').map(Number); return { x, y, ground }; }),
    };
  }

  get min(): number {
    return this.grid.min;
  }

  get max(): number {
    return this.grid.max;
  }

  get treeCount(): number {
    return this.#trees.size;
  }

  get oreCount(): number {
    return this.#ores.size;
  }

  get itemCount(): number {
    return this.#items.size;
  }

  get warehouseLevel(): number {
    return this.#warehouseLevel;
  }

  contains(position: Position): boolean {
    return this.grid.contains(position);
  }

  isBlocked(position: Position): boolean {
    const key = keyOf(position);
    return (
      this.grid.isBlocked(position) ||
      this.#treeAt.has(key) ||
      this.#ores.has(key)
    );
  }

  describe(position: Position): CellSnapshot {
    return { ground: this.#groundAt(position), item: this.itemAt(position) };
  }

  movementCost(position: Position): number {
    const ground = this.#specialGround.get(keyOf(position));
    return ground === 'sand' ? 2 : ground === 'ice' ? 0 : 1;
  }

  isBase(position: Position): boolean {
    return position.equals(this.base);
  }

  // --- itens (RN25)

  itemAt(position: Position): ItemKind | null {
    return this.#items.get(keyOf(position)) ?? null;
  }

  takeItem(position: Position): ItemKind | null {
    const item = this.itemAt(position);
    this.#items.delete(keyOf(position));
    return item;
  }

  // Põe o item numa casa livre e sem item; devolve se conseguiu
  placeItem(position: Position, item: ItemKind): boolean {
    if (
      !this.contains(position) ||
      this.isBlocked(position) ||
      this.#items.has(keyOf(position))
    ) {
      return false;
    }
    this.#items.set(keyOf(position), item);
    return true;
  }

  // --- jazidas (RN27)

  isOre(position: Position): boolean {
    return this.#ores.has(keyOf(position));
  }

  // Tira um minério da jazida. Quando ela acaba, a casa fica livre com uma pedra.
  mine(position: Position): MineResult | null {
    const ore = this.#ores.get(keyOf(position));
    if (ore === undefined) {
      return null;
    }
    ore.remaining--;
    if (ore.remaining > 0) {
      return { item: 'iron', depleted: false };
    }
    this.#ores.delete(keyOf(position));
    this.placeItem(position, 'stone');
    return { item: 'iron', depleted: true };
  }

  // RN28
  upgradeWarehouse(): void {
    this.#warehouseLevel++;
    this.warehouse.grow(WAREHOUSE_PER_LEVEL);
  }

  // --- o tempo (RN26, RN27)

  // Um tick do mundo. `isOccupied` diz onde há robô: nada cresce em cima dele.
  advance(isOccupied: (position: Position) => boolean): void {
    const { treeGrowEvery, treeMaxCells, branchEvery } = this.settings;
    for (const tree of [...this.#trees]) {
      tree.age++;
      if (tree.lifespan > 0 && tree.age >= tree.lifespan) {
        this.#fell(tree);
        continue;
      }
      if (
        treeGrowEvery > 0 &&
        tree.age % treeGrowEvery === 0 &&
        tree.cells.length < treeMaxCells
      ) {
        this.#grow(tree, isOccupied);
      }
      if (
        branchEvery > 0 &&
        tree.cells.length >= 3 &&
        tree.age % branchEvery === 0
      ) {
        this.#dropBranch(tree, isOccupied);
      }
    }
    const { treeEvery, maxTrees, oreEvery, maxOres } = this.settings;
    if (
      treeEvery > 0 &&
      this.#trees.size < maxTrees &&
      this.#random() < 1 / treeEvery
    ) {
      this.#spawnTree(isOccupied);
    }
    if (
      oreEvery > 0 &&
      this.#ores.size < maxOres &&
      this.#random() < 1 / oreEvery
    ) {
      this.#spawnOre(isOccupied);
    }
  }

  // Para testes e cenários: uma árvore nas casas dadas (respeitando RN11)
  plantTree(cells: readonly Position[], lifespan = 0): void {
    if (!this.#canBlock(cells, () => false)) {
      throw new RangeError('Não dá para plantar a árvore nessas casas');
    }
    this.#addTree({ cells: [...cells], age: 0, lifespan });
  }

  addOre(position: Position, remaining = this.settings.oreUses): void {
    if (!this.#canBlock([position], () => false)) {
      throw new RangeError('Não dá para pôr a jazida nessa casa');
    }
    this.#ores.set(keyOf(position), { position, remaining });
  }

  #groundAt(position: Position): Ground {
    const key = keyOf(position);
    if (this.grid.isBlocked(position)) {
      return 'rock';
    }
    if (this.#treeAt.has(key)) {
      return 'tree';
    }
    if (this.#ores.has(key)) {
      return 'ore';
    }
    return this.isBase(position) ? 'base' : this.#specialGround.get(key) ?? 'free';
  }

  #populate(): void {
    const { stones, initialTrees, initialOres, treeMaxCells, treeLifespan } =
      this.settings;
    let placed = 0;
    for (let i = 0; i < stones * 20 && placed < stones; i++) {
      const cell = this.#randomCell();
      if (!this.#nearBase(cell) && this.placeItem(cell, 'stone')) {
        placed++;
      }
    }
    for (let i = 0; i < initialTrees; i++) {
      const tree = this.#spawnTree(() => false);
      if (tree === undefined) {
        continue;
      }
      // Árvores de idades e tamanhos variados
      tree.age = Math.floor((this.#random() * treeLifespan) / 2);
      const extra = Math.floor(this.#random() * treeMaxCells);
      for (let g = 0; g < extra && tree.cells.length < treeMaxCells; g++) {
        this.#grow(tree, () => false);
      }
    }
    for (let i = 0; i < initialOres; i++) {
      this.#spawnOre(() => false);
    }
    for (let i = 0; i < Math.floor((this.max - this.min + 1) ** 2 * 0.025); i++) {
      const cell = this.#randomCell();
      if (!this.#nearBase(cell) && !this.isBlocked(cell) && !this.#items.has(keyOf(cell)) && !this.isBase(cell)) {
        this.#specialGround.set(keyOf(cell), i % 2 === 0 ? 'sand' : 'ice');
      }
    }
  }

  #spawnTree(isOccupied: (position: Position) => boolean): Tree | undefined {
    for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
      const cell = this.#randomCell();
      if (this.#canBlock([cell], isOccupied)) {
        const { treeLifespan } = this.settings;
        const lifespan =
          treeLifespan === 0
            ? 0
            : treeLifespan + Math.floor((this.#random() * treeLifespan) / 2);
        const tree: Tree = { cells: [cell], age: 0, lifespan };
        this.#addTree(tree);
        return tree;
      }
    }
    return undefined;
  }

  // Jazidas nascem encostadas nas rochas
  #spawnOre(isOccupied: (position: Position) => boolean): void {
    const rocks = this.grid.obstacles.flatMap((obstacle) => obstacle.cells);
    for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
      const rock = pick(rocks, this.#random);
      const cell = rock && pick(sideNeighbors(rock), this.#random);
      if (cell !== undefined && this.#canBlock([cell], isOccupied)) {
        this.#ores.set(keyOf(cell), {
          position: cell,
          remaining: this.settings.oreUses,
        });
        return;
      }
    }
  }

  #addTree(tree: Tree): void {
    this.#trees.add(tree);
    for (const cell of tree.cells) {
      this.#treeAt.set(keyOf(cell), tree);
    }
  }

  // A árvore ganha uma casa vizinha (pelos lados)
  #grow(tree: Tree, isOccupied: (position: Position) => boolean): void {
    const own = new Set(tree.cells.map(keyOf));
    const candidates = shuffle(
      tree.cells.flatMap(sideNeighbors).filter((cell) => !own.has(keyOf(cell))),
      this.#random,
    );
    const next = candidates.find((cell) => this.#canBlock([cell], isOccupied));
    if (next !== undefined) {
      tree.cells.push(next);
      this.#treeAt.set(keyOf(next), tree);
    }
  }

  // RN26: um galho numa casa livre em volta da árvore (inclusive na diagonal)
  #dropBranch(tree: Tree, isOccupied: (position: Position) => boolean): void {
    const around = tree.cells.flatMap((cell) => {
      const result: Position[] = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          result.push(cell.translate(dx, dy));
        }
      }
      return result;
    });
    const free = around.filter(
      (cell) =>
        this.contains(cell) &&
        !this.isBlocked(cell) &&
        !this.#items.has(keyOf(cell)) &&
        !this.isBase(cell) &&
        !isOccupied(cell),
    );
    const spot = pick(free, this.#random);
    if (spot !== undefined) {
      this.placeItem(spot, 'branch');
    }
  }

  // RN26: a árvore cai e deixa um tronco em cada casa que ocupava
  #fell(tree: Tree): void {
    this.#trees.delete(tree);
    for (const cell of tree.cells) {
      this.#treeAt.delete(keyOf(cell));
    }
    for (const cell of tree.cells) {
      this.placeItem(cell, 'log');
    }
  }

  // RN11/RN26: só bloqueia casas livres, sem item, sem robô, longe da base e dos
  // cantos, e sem isolar parte da malha
  #canBlock(
    cells: readonly Position[],
    isOccupied: (position: Position) => boolean,
  ): boolean {
    const cornerKeys = new Set(corners(this.min, this.max).map(keyOf));
    const valid = cells.every(
      (cell) =>
        this.contains(cell) &&
        !this.isBlocked(cell) &&
        !this.#items.has(keyOf(cell)) &&
        !isOccupied(cell) &&
        !this.#nearBase(cell) &&
        !cornerKeys.has(keyOf(cell)),
    );
    if (!valid) {
      return false;
    }
    const blocked = this.#blockedKeys();
    for (const cell of cells) {
      blocked.add(keyOf(cell));
    }
    return allFreeCellsConnected(this.min, this.max, blocked);
  }

  #blockedKeys(): Set<string> {
    const keys = new Set(
      this.grid.obstacles.flatMap((obstacle) => obstacle.cells.map(keyOf)),
    );
    for (const key of this.#treeAt.keys()) {
      keys.add(key);
    }
    for (const key of this.#ores.keys()) {
      keys.add(key);
    }
    return keys;
  }

  // A base e o 3x3 em volta ficam sempre livres
  #nearBase(cell: Position): boolean {
    return (
      Math.abs(cell.x - this.base.x) <= 1 && Math.abs(cell.y - this.base.y) <= 1
    );
  }

  #randomCell(): Position {
    const side = this.max - this.min + 1;
    return Position.create(
      this.min + Math.floor(this.#random() * side),
      this.min + Math.floor(this.#random() * side),
    );
  }
}

function toPosition([x, y]: [number, number]): Position {
  return Position.create(x, y);
}

function toPair({ x, y }: Position): [number, number] {
  return [x, y];
}

function pick<T>(items: readonly T[], random: Random): T | undefined {
  return items[Math.floor(random() * items.length)];
}

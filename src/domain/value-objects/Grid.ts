import type { CellSnapshot, Terrain } from '../world/Terrain.js';
import { keyOf, sideNeighbors, type Obstacle } from './Obstacle.js';
import { Position } from './Position.js';

export const STANDARD_LIMIT = 15;

// A malha fixa: limites e rochas (obstáculos que nunca mudam)
export class Grid implements Terrain {
  readonly min: number;
  readonly max: number;
  readonly obstacles: readonly Obstacle[];
  readonly #blocked: ReadonlySet<string>;

  private constructor(
    min: number,
    max: number,
    obstacles: readonly Obstacle[],
    blocked: ReadonlySet<string>,
  ) {
    this.min = min;
    this.max = max;
    this.obstacles = Object.freeze([...obstacles]);
    this.#blocked = blocked;
    Object.freeze(this);
  }

  // RN09, RN11: obstáculos dentro da malha, sem sobreposição, sem ocupar cantos
  // e sem separar a malha em partes isoladas
  static create(
    min: number,
    max: number,
    obstacles: readonly Obstacle[] = [],
  ): Grid {
    if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
      throw new RangeError('Limites da malha inválidos');
    }
    const blocked = new Set<string>();
    for (const cell of obstacles.flatMap((obstacle) => obstacle.cells)) {
      if (!inRange(cell, min, max)) {
        throw new RangeError(`Obstáculo fora da malha: ${describe(cell)}`);
      }
      if (blocked.has(keyOf(cell))) {
        throw new RangeError(`Obstáculos sobrepostos em ${describe(cell)}`);
      }
      blocked.add(keyOf(cell));
    }
    const blockedCorner = corners(min, max).find((corner) =>
      blocked.has(keyOf(corner)),
    );
    if (blockedCorner !== undefined) {
      throw new RangeError(
        `Os cantos da malha não podem ter obstáculo: ${describe(blockedCorner)}`,
      );
    }
    if (!allFreeCellsConnected(min, max, blocked)) {
      throw new RangeError('Os obstáculos isolam uma parte da malha');
    }
    return new Grid(min, max, obstacles, blocked);
  }

  // RN02: malha quadrada de -limit a limit, com a origem no centro
  static square(limit: number, obstacles: readonly Obstacle[] = []): Grid {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new RangeError('O limite da malha deve ser um inteiro maior que 0');
    }
    return Grid.create(-limit, limit, obstacles);
  }

  // RN02
  static standard(): Grid {
    return Grid.square(STANDARD_LIMIT);
  }

  contains(position: Position): boolean {
    return inRange(position, this.min, this.max);
  }

  // RN09
  isBlocked(position: Position): boolean {
    return this.#blocked.has(keyOf(position));
  }

  describe(position: Position): CellSnapshot {
    return { ground: this.isBlocked(position) ? 'rock' : 'free', item: null };
  }
}

function inRange({ x, y }: Position, min: number, max: number): boolean {
  return x >= min && x <= max && y >= min && y <= max;
}

function describe({ x, y }: Position): string {
  return `(${String(x)}, ${String(y)})`;
}

export function corners(min: number, max: number): Position[] {
  return [
    Position.create(min, min),
    Position.create(min, max),
    Position.create(max, min),
    Position.create(max, max),
  ];
}

// RN11: busca em largura a partir de um canto (sempre livre) pelas células livres.
// Se alcançar todas, nenhuma parte da malha ficou isolada.
export function allFreeCellsConnected(
  min: number,
  max: number,
  blocked: ReadonlySet<string>,
): boolean {
  const side = max - min + 1;
  const freeCells = side * side - blocked.size;
  const start = Position.create(min, min);
  const visited = new Set([keyOf(start)]);
  const queue: Position[] = [start];
  for (let current = queue.shift(); current; current = queue.shift()) {
    for (const next of sideNeighbors(current)) {
      const key = keyOf(next);
      if (inRange(next, min, max) && !blocked.has(key) && !visited.has(key)) {
        visited.add(key);
        queue.push(next);
      }
    }
  }
  return visited.size === freeCells;
}

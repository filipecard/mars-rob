import type { Position } from './Position.js';

// RN10: um obstáculo é um bloco de células ligadas pelos lados (reta, L, T, Z, quadrado...)
export class Obstacle {
  readonly cells: readonly Position[];

  private constructor(cells: readonly Position[]) {
    this.cells = Object.freeze([...cells]);
    Object.freeze(this);
  }

  static create(cells: readonly Position[]): Obstacle {
    if (cells.length === 0) {
      throw new RangeError('Um obstáculo precisa de pelo menos uma célula');
    }
    const keys = new Set(cells.map(keyOf));
    if (keys.size !== cells.length) {
      throw new RangeError('Um obstáculo não pode repetir células');
    }
    if (!isConnected(cells, keys)) {
      throw new RangeError('As células de um obstáculo precisam estar ligadas');
    }
    return new Obstacle(cells);
  }

  get size(): number {
    return this.cells.length;
  }

  covers(position: Position): boolean {
    return this.cells.some((cell) => cell.equals(position));
  }
}

export function keyOf({ x, y }: { x: number; y: number }): string {
  return `${String(x)},${String(y)}`;
}

export function sideNeighbors(position: Position): Position[] {
  return [
    position.translate(0, 1),
    position.translate(0, -1),
    position.translate(1, 0),
    position.translate(-1, 0),
  ];
}

function isConnected(
  cells: readonly Position[],
  keys: ReadonlySet<string>,
): boolean {
  const [first] = cells;
  if (first === undefined) {
    return false;
  }
  const visited = new Set([keyOf(first)]);
  const queue: Position[] = [first];
  for (let current = queue.shift(); current; current = queue.shift()) {
    for (const next of sideNeighbors(current)) {
      const key = keyOf(next);
      if (keys.has(key) && !visited.has(key)) {
        visited.add(key);
        queue.push(next);
      }
    }
  }
  return visited.size === cells.length;
}

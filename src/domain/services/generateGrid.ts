import { allFreeCellsConnected, corners, Grid } from '../value-objects/Grid.js';
import { keyOf, Obstacle, sideNeighbors } from '../value-objects/Obstacle.js';
import { Position } from '../value-objects/Position.js';

// Fonte de aleatoriedade: devolve um número em [0, 1), como Math.random
export type Random = () => number;

export interface ObstacleSettings {
  count: number;
  maxSize: number;
}

// Tentativas por obstáculo antes de desistir (malha pequena ou lotada demais)
const MAX_ATTEMPTS = 500;

// RN10, RN11: sorteia `count` obstáculos de 1 a `maxSize` células cada.
// Cada obstáculo cresce a partir de uma célula para vizinhos sorteados, então o
// formato (reta, L, T, Z...) sai automaticamente. Um obstáculo só é aceito se não
// ocupar origem nem cantos, não encostar em outro e não isolar parte da malha.
export function generateGrid(
  limit: number,
  { count, maxSize }: ObstacleSettings,
  random: Random,
): Grid {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError('A quantidade de obstáculos deve ser um inteiro >= 0');
  }
  if (!Number.isInteger(maxSize) || maxSize < 1) {
    throw new RangeError(
      'O tamanho máximo do obstáculo deve ser um inteiro >= 1',
    );
  }
  const empty = Grid.square(limit);
  const { min, max } = empty;

  const blocked = new Set<string>();
  // Células proibidas para novos obstáculos: origem, cantos e a vizinhança
  // (inclusive diagonal) dos obstáculos já colocados
  const forbidden = new Set(
    [Position.origin(), ...corners(min, max)].map(keyOf),
  );
  const obstacles: Obstacle[] = [];

  for (let i = 0; i < count; i++) {
    const obstacle = placeObstacle(empty, blocked, forbidden, maxSize, random);
    if (obstacle === undefined) {
      throw new RangeError(
        `Não há espaço para ${String(count)} obstáculos de até ${String(maxSize)} ` +
          `células numa malha de limite ${String(limit)} sem bloquear o caminho do robô`,
      );
    }
    obstacles.push(obstacle);
    for (const cell of obstacle.cells) {
      blocked.add(keyOf(cell));
      for (const around of surroundings(cell)) {
        forbidden.add(keyOf(around));
      }
    }
  }
  return Grid.square(limit, obstacles);
}

function placeObstacle(
  grid: Grid,
  blocked: ReadonlySet<string>,
  forbidden: ReadonlySet<string>,
  maxSize: number,
  random: Random,
): Obstacle | undefined {
  const isFree = (position: Position): boolean =>
    grid.contains(position) && !forbidden.has(keyOf(position));
  const candidates = allCells(grid).filter(isFree);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const start = pick(candidates, random);
    if (start === undefined) {
      return undefined;
    }
    const size = 1 + Math.floor(random() * maxSize);
    const cells = grow(start, size, isFree, random);
    if (cells === undefined) {
      continue;
    }
    const withShape = new Set([...blocked, ...cells.map(keyOf)]);
    if (allFreeCellsConnected(grid.min, grid.max, withShape)) {
      return Obstacle.create(cells);
    }
  }
  return undefined;
}

// Cresce o formato célula a célula, sorteando um vizinho livre de qualquer célula já incluída
function grow(
  start: Position,
  size: number,
  isFree: (position: Position) => boolean,
  random: Random,
): Position[] | undefined {
  const cells = [start];
  const keys = new Set([keyOf(start)]);
  while (cells.length < size) {
    const frontier = cells
      .flatMap(sideNeighbors)
      .filter((next) => isFree(next) && !keys.has(keyOf(next)));
    const next = pick(frontier, random);
    if (next === undefined) {
      return undefined;
    }
    cells.push(next);
    keys.add(keyOf(next));
  }
  return cells;
}

function surroundings(cell: Position): Position[] {
  const result: Position[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      result.push(cell.translate(dx, dy));
    }
  }
  return result;
}

function allCells({ min, max }: Grid): Position[] {
  const cells: Position[] = [];
  for (let x = min; x <= max; x++) {
    for (let y = min; y <= max; y++) {
      cells.push(Position.create(x, y));
    }
  }
  return cells;
}

function pick<T>(items: readonly T[], random: Random): T | undefined {
  return items[Math.floor(random() * items.length)];
}

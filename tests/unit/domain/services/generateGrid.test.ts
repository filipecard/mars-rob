import { describe, expect, it } from 'vitest';
import { generateGrid } from '../../../../src/domain/services/generateGrid.js';
import type { Grid } from '../../../../src/domain/value-objects/Grid.js';
import { Position } from '../../../../src/domain/value-objects/Position.js';
import { seededRandom } from '../../../../src/infrastructure/random/seededRandom.js';

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

const key = ({ x, y }: Position): string => `${String(x)},${String(y)}`;

// Busca em largura independente da implementação: quais células livres o robô alcança a partir da origem
function reachableFromOrigin(grid: Grid): Set<string> {
  const start = Position.origin();
  const seen = new Set([key(start)]);
  const queue = [start];
  for (let current = queue.shift(); current; current = queue.shift()) {
    for (const next of [
      current.translate(0, 1),
      current.translate(0, -1),
      current.translate(1, 0),
      current.translate(-1, 0),
    ]) {
      if (
        grid.contains(next) &&
        !grid.isBlocked(next) &&
        !seen.has(key(next))
      ) {
        seen.add(key(next));
        queue.push(next);
      }
    }
  }
  return seen;
}

const cellsOf = (grid: Grid): string[][] =>
  grid.obstacles.map((obstacle) => obstacle.cells.map(key));

describe('generateGrid', () => {
  it('sem obstáculos gera a malha vazia', () => {
    const grid = generateGrid(15, { count: 0, maxSize: 4 }, seededRandom(1));

    expect(grid.min).toBe(-15);
    expect(grid.max).toBe(15);
    expect(grid.obstacles).toEqual([]);
  });

  it.each(SEEDS)(
    'semente %i: gera a quantidade pedida com tamanhos de 1 ao máximo — RN10',
    (seed) => {
      const grid = generateGrid(
        15,
        { count: 4, maxSize: 4 },
        seededRandom(seed),
      );

      expect(grid.obstacles).toHaveLength(4);
      for (const obstacle of grid.obstacles) {
        expect(obstacle.size).toBeGreaterThanOrEqual(1);
        expect(obstacle.size).toBeLessThanOrEqual(4);
      }
    },
  );

  it.each(SEEDS)(
    'semente %i: o robô alcança toda célula livre, os 4 lados e os 4 cantos — RN11',
    (seed) => {
      const grid = generateGrid(
        5,
        { count: 6, maxSize: 5 },
        seededRandom(seed),
      );
      const reachable = reachableFromOrigin(grid);
      const blockedCells = grid.obstacles.reduce((sum, o) => sum + o.size, 0);

      expect(reachable.size).toBe(11 * 11 - blockedCells);
      for (const corner of ['-5,-5', '-5,5', '5,-5', '5,5']) {
        expect(reachable.has(corner)).toBe(true);
      }
      expect(grid.isBlocked(Position.origin())).toBe(false);
    },
  );

  it.each(SEEDS)('semente %i: obstáculos não se encostam', (seed) => {
    const grid = generateGrid(8, { count: 6, maxSize: 4 }, seededRandom(seed));

    grid.obstacles.forEach((a, i) => {
      for (const b of grid.obstacles.slice(i + 1)) {
        for (const ca of a.cells) {
          for (const cb of b.cells) {
            const touching =
              Math.abs(ca.x - cb.x) <= 1 && Math.abs(ca.y - cb.y) <= 1;
            expect(touching).toBe(false);
          }
        }
      }
    });
  });

  it('a mesma semente gera o mesmo mapa', () => {
    const settings = { count: 5, maxSize: 4 };

    expect(cellsOf(generateGrid(15, settings, seededRandom(7)))).toEqual(
      cellsOf(generateGrid(15, settings, seededRandom(7))),
    );
    expect(cellsOf(generateGrid(15, settings, seededRandom(7)))).not.toEqual(
      cellsOf(generateGrid(15, settings, seededRandom(8))),
    );
  });

  it('gera formatos variados: retas e formatos com curva — RN10', () => {
    let straight = 0;
    let bent = 0;
    for (const seed of SEEDS) {
      const grid = generateGrid(
        15,
        { count: 4, maxSize: 4 },
        seededRandom(seed),
      );
      for (const { cells, size } of grid.obstacles) {
        if (size < 3) {
          continue;
        }
        const sameRow = new Set(cells.map((c) => c.y)).size === 1;
        const sameColumn = new Set(cells.map((c) => c.x)).size === 1;
        if (sameRow || sameColumn) {
          straight++;
        } else {
          bent++;
        }
      }
    }

    expect(straight).toBeGreaterThan(0);
    expect(bent).toBeGreaterThan(0);
  });

  it('com tamanho máximo 1 todos os obstáculos têm uma célula', () => {
    const grid = generateGrid(10, { count: 8, maxSize: 1 }, seededRandom(3));

    expect(grid.obstacles.every((o) => o.size === 1)).toBe(true);
  });

  it('falha quando não cabe tudo sem bloquear o caminho — RN11', () => {
    expect(() =>
      generateGrid(1, { count: 10, maxSize: 4 }, seededRandom(1)),
    ).toThrow('Não há espaço para 10 obstáculos');
  });

  it.each([
    [{ count: -1, maxSize: 4 }, 'quantidade'],
    [{ count: 1.5, maxSize: 4 }, 'quantidade'],
    [{ count: 4, maxSize: 0 }, 'tamanho máximo'],
  ])('rejeita configuração inválida %j', (settings, text) => {
    expect(() => generateGrid(15, settings, seededRandom(1))).toThrow(text);
  });
});

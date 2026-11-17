import { describe, expect, it } from 'vitest';
import { Grid } from '../../../../src/domain/value-objects/Grid.js';
import { Obstacle } from '../../../../src/domain/value-objects/Obstacle.js';
import { Position } from '../../../../src/domain/value-objects/Position.js';

describe('Grid', () => {
  const grid = Grid.standard();

  it('a malha padrão vai de -15 a 15 — RN02', () => {
    expect(grid.min).toBe(-15);
    expect(grid.max).toBe(15);
  });

  it.each([
    [0, 0],
    [15, 15],
    [-15, -15],
    [15, -15],
    [-15, 15],
  ])('contém (%i,%i)', (x, y) => {
    expect(grid.contains(Position.create(x, y))).toBe(true);
  });

  it.each([
    [16, 0],
    [-16, 0],
    [0, 16],
    [0, -16],
  ])('não contém (%i,%i)', (x, y) => {
    expect(grid.contains(Position.create(x, y))).toBe(false);
  });

  it('rejeita limites inválidos', () => {
    expect(() => Grid.create(5, -5)).toThrow(RangeError);
    expect(() => Grid.create(0.5, 5)).toThrow(RangeError);
  });

  it.each([1, 3, 15])('Grid.square(%i) vai de -%i a %i — RN02', (limit) => {
    const square = Grid.square(limit);
    expect(square.min).toBe(-limit);
    expect(square.max).toBe(limit);
  });

  it.each([0, -1, 2.5])('rejeita o limite %s', (limit) => {
    expect(() => Grid.square(limit)).toThrow(RangeError);
  });

  it('a malha padrão não tem obstáculos', () => {
    expect(grid.obstacles).toEqual([]);
  });

  it('sabe quais posições estão bloqueadas — RN09', () => {
    const withObstacles = Grid.square(5, [
      shape([1, 2], [1, 3]),
      shape([-3, 0]),
    ]);

    expect(withObstacles.isBlocked(Position.create(1, 2))).toBe(true);
    expect(withObstacles.isBlocked(Position.create(1, 3))).toBe(true);
    expect(withObstacles.isBlocked(Position.create(-3, 0))).toBe(true);
    expect(withObstacles.isBlocked(Position.create(2, 1))).toBe(false);
  });

  it('rejeita obstáculo fora da malha — RN09', () => {
    expect(() => Grid.square(5, [shape([5, 0], [6, 0])])).toThrow(
      'Obstáculo fora da malha: (6, 0)',
    );
  });

  it('rejeita obstáculos sobrepostos', () => {
    expect(() =>
      Grid.square(5, [shape([1, 1], [1, 2]), shape([1, 2], [2, 2])]),
    ).toThrow('Obstáculos sobrepostos em (1, 2)');
  });

  it.each([
    [-5, -5],
    [-5, 5],
    [5, -5],
    [5, 5],
  ])('rejeita obstáculo no canto (%i,%i) — RN11', (x, y) => {
    expect(() => Grid.square(5, [shape([x, y])])).toThrow(
      'Os cantos da malha não podem ter obstáculo',
    );
  });

  it('rejeita uma parede que corta a malha de lado a lado — RN11', () => {
    const wall = Array.from({ length: 9 }, (_, i): [number, number] => [
      i - 4,
      2,
    ]);
    // Deixa só os cantos livres: (-5,2) e (5,2) também bloqueados fecham a passagem
    expect(() => Grid.square(5, [shape([-5, 2], ...wall, [5, 2])])).toThrow(
      'Os obstáculos isolam uma parte da malha',
    );
  });

  it('rejeita obstáculos que cercam uma célula — RN11', () => {
    // Um anel em volta de (2,2): a célula do meio fica inalcançável
    const ring = shape(
      [1, 1],
      [2, 1],
      [3, 1],
      [3, 2],
      [3, 3],
      [2, 3],
      [1, 3],
      [1, 2],
    );

    expect(() => Grid.square(5, [ring])).toThrow(
      'Os obstáculos isolam uma parte da malha',
    );
  });

  it('aceita uma parede com passagem — RN11', () => {
    const wall = Array.from({ length: 10 }, (_, i): [number, number] => [
      i - 4,
      2,
    ]);

    expect(() => Grid.square(5, [shape(...wall)])).not.toThrow();
  });

  it('a lista de obstáculos não pode ser alterada por fora', () => {
    const obstacles = [shape([1, 1])];
    const withObstacles = Grid.square(5, obstacles);

    obstacles.push(shape([3, 3]));

    expect(withObstacles.obstacles).toHaveLength(1);
    expect(Object.isFrozen(withObstacles.obstacles)).toBe(true);
  });
});

function shape(...cells: [number, number][]): Obstacle {
  return Obstacle.create(cells.map(([x, y]) => Position.create(x, y)));
}

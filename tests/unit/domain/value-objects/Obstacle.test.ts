import { describe, expect, it } from 'vitest';
import { Obstacle } from '../../../../src/domain/value-objects/Obstacle.js';
import { Position } from '../../../../src/domain/value-objects/Position.js';

const cells = (...pairs: [number, number][]): Position[] =>
  pairs.map(([x, y]) => Position.create(x, y));

describe('Obstacle — RN10', () => {
  it.each([
    ['uma célula', cells([0, 0])],
    ['reta', cells([0, 0], [1, 0], [2, 0])],
    ['L', cells([0, 0], [0, 1], [0, 2], [1, 0])],
    ['T', cells([0, 0], [1, 0], [2, 0], [1, 1])],
    ['quadrado', cells([0, 0], [1, 0], [0, 1], [1, 1])],
  ])('aceita o formato %s', (_name, shape) => {
    const obstacle = Obstacle.create(shape);

    expect(obstacle.size).toBe(shape.length);
    for (const cell of shape) {
      expect(obstacle.covers(cell)).toBe(true);
    }
  });

  it('não cobre células fora dele', () => {
    expect(Obstacle.create(cells([0, 0])).covers(Position.create(0, 1))).toBe(
      false,
    );
  });

  it('rejeita obstáculo vazio', () => {
    expect(() => Obstacle.create([])).toThrow(RangeError);
  });

  it('rejeita células repetidas', () => {
    expect(() => Obstacle.create(cells([0, 0], [0, 0]))).toThrow(
      'não pode repetir',
    );
  });

  it.each([
    ['separadas', cells([0, 0], [2, 0])],
    ['só na diagonal', cells([0, 0], [1, 1])],
  ])('rejeita células %s', (_name, shape) => {
    expect(() => Obstacle.create(shape)).toThrow('precisam estar ligadas');
  });
});

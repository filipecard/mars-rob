import { describe, expect, it } from 'vitest';
import { Grid } from '../../../../src/domain/value-objects/Grid.js';
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
});

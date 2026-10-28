import { describe, expect, it } from 'vitest';
import {
  isDirection,
  step,
  type Direction,
} from '../../../../src/domain/value-objects/Direction.js';
import { Position } from '../../../../src/domain/value-objects/Position.js';

describe('Direction', () => {
  it.each<[Direction, number, number]>([
    ['N', 0, 1],
    ['S', 0, -1],
    ['L', 1, 0],
    ['O', -1, 0],
  ])('step %s a partir da origem leva a (%i,%i) — RN03', (direction, x, y) => {
    const next = step(Position.origin(), direction);

    expect(next.equals(Position.create(x, y))).toBe(true);
  });

  it.each(['N', 'S', 'L', 'O'])('"%s" é direção', (value) => {
    expect(isDirection(value)).toBe(true);
  });

  it.each(['n', 'X', '1', ' ', '', 'NN'])('"%s" não é direção', (value) => {
    expect(isDirection(value)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { Position } from '../../../../src/domain/value-objects/Position.js';

describe('Position', () => {
  it('cria uma posição com as coordenadas informadas', () => {
    const position = Position.create(3, -7);

    expect(position.x).toBe(3);
    expect(position.y).toBe(-7);
  });

  it('rejeita coordenadas não inteiras', () => {
    expect(() => Position.create(1.5, 0)).toThrow(RangeError);
    expect(() => Position.create(0, Number.NaN)).toThrow(RangeError);
  });

  it('origin() é (0,0) — RN01', () => {
    expect(Position.origin().equals(Position.create(0, 0))).toBe(true);
  });

  it('equals compara por valor', () => {
    expect(Position.create(1, 2).equals(Position.create(1, 2))).toBe(true);
    expect(Position.create(1, 2).equals(Position.create(2, 1))).toBe(false);
  });

  it('translate devolve uma nova posição sem alterar a original', () => {
    const original = Position.create(1, 1);

    const moved = original.translate(2, -3);

    expect(moved.equals(Position.create(3, -2))).toBe(true);
    expect(original.equals(Position.create(1, 1))).toBe(true);
  });

  it('é imutável', () => {
    expect(Object.isFrozen(Position.create(1, 1))).toBe(true);
  });
});

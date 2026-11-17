import { describe, expect, it } from 'vitest';
import {
  MAX_SEED,
  randomSeed,
  seededRandom,
} from '../../../src/infrastructure/random/seededRandom.js';

const take = (random: () => number, n: number): number[] =>
  Array.from({ length: n }, () => random());

describe('seededRandom', () => {
  it('a mesma semente gera a mesma sequência', () => {
    expect(take(seededRandom(123), 20)).toEqual(take(seededRandom(123), 20));
  });

  it('sementes diferentes geram sequências diferentes', () => {
    expect(take(seededRandom(1), 5)).not.toEqual(take(seededRandom(2), 5));
  });

  it('gera números em [0, 1)', () => {
    for (const value of take(seededRandom(99), 1000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('randomSeed sorteia um inteiro válido', () => {
    const seed = randomSeed();

    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(MAX_SEED);
  });
});

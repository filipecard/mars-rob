import type { Random } from '../../domain/services/generateGrid.js';

export const MAX_SEED = 2 ** 32 - 1;

// mulberry32: gerador pseudoaleatório pequeno. A mesma semente sempre gera a mesma sequência.
export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * MAX_SEED);
}

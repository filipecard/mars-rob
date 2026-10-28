import type { Position } from './Position.js';

export const DIRECTIONS = ['N', 'S', 'L', 'O'] as const;

export type Direction = (typeof DIRECTIONS)[number];

// RN03
const DELTAS: Record<Direction, { dx: number; dy: number }> = {
  N: { dx: 0, dy: 1 },
  S: { dx: 0, dy: -1 },
  L: { dx: 1, dy: 0 },
  O: { dx: -1, dy: 0 },
};

export function isDirection(value: string): value is Direction {
  return (DIRECTIONS as readonly string[]).includes(value);
}

export function step(position: Position, direction: Direction): Position {
  const { dx, dy } = DELTAS[direction];
  return position.translate(dx, dy);
}

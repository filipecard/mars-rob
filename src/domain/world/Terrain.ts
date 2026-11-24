import type { Position } from '../value-objects/Position.js';
import type { ItemKind } from './Item.js';

// O que há no chão de uma casa. 'base' é livre; 'rock', 'tree' e 'ore' bloqueiam.
export type Ground = 'free' | 'base' | 'rock' | 'tree' | 'ore';

// Como uma casa está num momento: é o que o robô guarda no mapa dele (RN12)
export interface CellSnapshot {
  ground: Ground;
  item: ItemKind | null;
}

export function isBlockingGround(ground: Ground): boolean {
  return ground === 'rock' || ground === 'tree' || ground === 'ore';
}

// O chão onde os robôs andam: a malha fixa (Grid) ou o mundo vivo (World)
export interface Terrain {
  readonly min: number;
  readonly max: number;
  contains(position: Position): boolean;
  isBlocked(position: Position): boolean;
  describe(position: Position): CellSnapshot;
}

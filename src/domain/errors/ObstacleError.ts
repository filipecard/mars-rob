import type { Position } from '../value-objects/Position.js';
import { DomainError } from './DomainError.js';

// RN09
export class ObstacleError extends DomainError {
  constructor(readonly position: Position) {
    super(`Há um obstáculo em (${String(position.x)}, ${String(position.y)})`);
  }
}

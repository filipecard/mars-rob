import type { Position } from '../value-objects/Position.js';
import { DomainError } from './DomainError.js';

// RN15
export class CollisionError extends DomainError {
  constructor(
    readonly position: Position,
    readonly robotId: number,
  ) {
    super(
      `O robô ${String(robotId)} está em (${String(position.x)}, ${String(position.y)})`,
    );
  }
}

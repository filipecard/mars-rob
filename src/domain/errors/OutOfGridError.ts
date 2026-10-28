import type { Position } from '../value-objects/Position.js';
import { DomainError } from './DomainError.js';

// RN04
export class OutOfGridError extends DomainError {
  constructor(readonly position: Position) {
    super(
      `Posição fora da malha: (${String(position.x)}, ${String(position.y)})`,
    );
  }
}

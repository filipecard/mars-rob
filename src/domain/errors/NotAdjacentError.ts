import { DomainError } from './DomainError.js';

// RN16: só robôs lado a lado podem compartilhar o mapa
export class NotAdjacentError extends DomainError {
  constructor(
    readonly from: number,
    readonly to: number,
  ) {
    super(`Os robôs ${String(from)} e ${String(to)} não estão lado a lado`);
  }
}

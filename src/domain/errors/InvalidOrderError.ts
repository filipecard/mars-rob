import { DomainError } from './DomainError.js';

// RN14: a ordem não está no formato ID:COMANDOS
export class InvalidOrderError extends DomainError {
  constructor(readonly input: string) {
    super(`Ordem inválida: "${input}"`);
  }
}

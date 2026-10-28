import { DomainError } from './DomainError.js';

// RN07
export class InvalidCommandError extends DomainError {
  constructor(readonly input: string) {
    super(`Comando inválido: "${input}"`);
  }
}

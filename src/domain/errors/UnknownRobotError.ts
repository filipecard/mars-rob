import { DomainError } from './DomainError.js';

// RN14
export class UnknownRobotError extends DomainError {
  constructor(readonly robotId: number) {
    super(`Não existe robô com ID ${String(robotId)}`);
  }
}

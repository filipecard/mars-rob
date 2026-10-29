import { InvalidCommandError } from '../errors/InvalidCommandError.js';
import { isDirection, type Direction } from './Direction.js';
import { isTurn, type Turn } from './Orientation.js';

// Um passo relativo (N, S, L, O) ou um giro (D, E), na ordem em que foi digitado
export type Instruction = Direction | Turn;

export class Command {
  readonly instructions: readonly Instruction[];

  private constructor(instructions: readonly Instruction[]) {
    this.instructions = Object.freeze(instructions);
    Object.freeze(this);
  }

  // RN07: só N, S, L, O, D, E maiúsculas, sem espaços; "" é um comando vazio válido
  static parse(input: string): Command {
    const instructions: Instruction[] = [];
    for (const char of input) {
      if (!isDirection(char) && !isTurn(char)) {
        throw new InvalidCommandError(input);
      }
      instructions.push(char);
    }
    return new Command(instructions);
  }
}

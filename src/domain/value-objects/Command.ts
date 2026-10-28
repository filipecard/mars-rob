import { InvalidCommandError } from '../errors/InvalidCommandError.js';
import { isDirection, type Direction } from './Direction.js';

export class Command {
  readonly directions: readonly Direction[];

  private constructor(directions: readonly Direction[]) {
    this.directions = Object.freeze(directions);
    Object.freeze(this);
  }

  // RN07: só N, S, L, O maiúsculas, sem espaços; "" é um comando vazio válido
  static parse(input: string): Command {
    const directions: Direction[] = [];
    for (const char of input) {
      if (!isDirection(char)) {
        throw new InvalidCommandError(input);
      }
      directions.push(char);
    }
    return new Command(directions);
  }
}

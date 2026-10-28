import { OutOfGridError } from '../errors/OutOfGridError.js';
import type { Command } from '../value-objects/Command.js';
import { step } from '../value-objects/Direction.js';
import type { Grid } from '../value-objects/Grid.js';
import { Position } from '../value-objects/Position.js';

export class Robot {
  readonly grid: Grid;
  #position: Position;

  private constructor(grid: Grid, position: Position) {
    this.grid = grid;
    this.#position = position;
  }

  static create(grid: Grid, position: Position = Position.origin()): Robot {
    if (!grid.contains(position)) {
      throw new OutOfGridError(position);
    }
    return new Robot(grid, position);
  }

  get position(): Position {
    return this.#position;
  }

  // RN04: valida a cada passo. RN05: só atualiza a posição se todos os passos forem válidos.
  execute(command: Command): void {
    let next = this.#position;
    for (const direction of command.directions) {
      next = step(next, direction);
      if (!this.grid.contains(next)) {
        throw new OutOfGridError(next);
      }
    }
    this.#position = next;
  }
}

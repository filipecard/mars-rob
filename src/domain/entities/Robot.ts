import { OutOfGridError } from '../errors/OutOfGridError.js';
import type { Command } from '../value-objects/Command.js';
import { step } from '../value-objects/Direction.js';
import type { Grid } from '../value-objects/Grid.js';
import {
  isTurn,
  toAbsolute,
  turn,
  type Orientation,
} from '../value-objects/Orientation.js';
import { Position } from '../value-objects/Position.js';

export class Robot {
  readonly grid: Grid;
  #position: Position;
  #orientation: Orientation;

  private constructor(
    grid: Grid,
    position: Position,
    orientation: Orientation,
  ) {
    this.grid = grid;
    this.#position = position;
    this.#orientation = orientation;
  }

  // RN01
  static create(
    grid: Grid,
    position: Position = Position.origin(),
    orientation: Orientation = 'N',
  ): Robot {
    if (!grid.contains(position)) {
      throw new OutOfGridError(position);
    }
    return new Robot(grid, position, orientation);
  }

  get position(): Position {
    return this.#position;
  }

  get orientation(): Orientation {
    return this.#orientation;
  }

  // Executa as instruções na ordem: cada passo usa a orientação deixada pelos giros anteriores.
  // RN04: valida a cada passo. RN05: só atualiza posição e orientação se todos os passos forem válidos.
  execute(command: Command): void {
    let position = this.#position;
    let orientation = this.#orientation;
    for (const instruction of command.instructions) {
      if (isTurn(instruction)) {
        orientation = turn(orientation, instruction);
        continue;
      }
      position = step(position, toAbsolute(orientation, instruction));
      if (!this.grid.contains(position)) {
        throw new OutOfGridError(position);
      }
    }
    this.#position = position;
    this.#orientation = orientation;
  }
}

import { ObstacleError } from '../errors/ObstacleError.js';
import { OutOfGridError } from '../errors/OutOfGridError.js';
import type { Command } from '../value-objects/Command.js';
import { step } from '../value-objects/Direction.js';
import type { Grid } from '../value-objects/Grid.js';
import { keyOf } from '../value-objects/Obstacle.js';
import {
  isTurn,
  toAbsolute,
  turn,
  type Orientation,
} from '../value-objects/Orientation.js';
import { Position } from '../value-objects/Position.js';

// RN12: o robô enxerga a casa onde está e 1 casa em todas as direções (inclusive diagonais)
export const VISION_RANGE = 1;

export class Robot {
  readonly grid: Grid;
  #position: Position;
  #orientation: Orientation;
  // RN12: casas que o robô já viu, pela chave "x,y"
  readonly #explored = new Map<string, Position>();

  private constructor(
    grid: Grid,
    position: Position,
    orientation: Orientation,
  ) {
    this.grid = grid;
    this.#position = position;
    this.#orientation = orientation;
    this.#lookAround(position);
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
    if (grid.isBlocked(position)) {
      throw new ObstacleError(position);
    }
    return new Robot(grid, position, orientation);
  }

  get position(): Position {
    return this.#position;
  }

  get orientation(): Orientation {
    return this.#orientation;
  }

  // RN12: casas já vistas, na ordem em que foram descobertas
  get explored(): readonly Position[] {
    return [...this.#explored.values()];
  }

  hasExplored(position: Position): boolean {
    return this.#explored.has(keyOf(position));
  }

  // Executa as instruções na ordem: cada passo usa a orientação deixada pelos giros anteriores.
  // RN04/RN09: valida limite e obstáculo a cada passo.
  // RN05: só atualiza posição, orientação e exploração se todos os passos forem válidos.
  execute(command: Command): void {
    let position = this.#position;
    let orientation = this.#orientation;
    const path: Position[] = [];
    for (const instruction of command.instructions) {
      if (isTurn(instruction)) {
        orientation = turn(orientation, instruction);
        continue;
      }
      position = step(position, toAbsolute(orientation, instruction));
      if (!this.grid.contains(position)) {
        throw new OutOfGridError(position);
      }
      if (this.grid.isBlocked(position)) {
        throw new ObstacleError(position);
      }
      path.push(position);
    }
    this.#position = position;
    this.#orientation = orientation;
    // RN12: revela a vizinhança de cada casa do caminho, não só a do destino
    for (const visited of path) {
      this.#lookAround(visited);
    }
  }

  #lookAround(center: Position): void {
    for (let dx = -VISION_RANGE; dx <= VISION_RANGE; dx++) {
      for (let dy = -VISION_RANGE; dy <= VISION_RANGE; dy++) {
        const seen = center.translate(dx, dy);
        if (this.grid.contains(seen)) {
          this.#explored.set(keyOf(seen), seen);
        }
      }
    }
  }
}

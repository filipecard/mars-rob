import type { Position } from './Position.js';

export class Grid {
  readonly min: number;
  readonly max: number;

  private constructor(min: number, max: number) {
    this.min = min;
    this.max = max;
    Object.freeze(this);
  }

  static create(min: number, max: number): Grid {
    if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
      throw new RangeError('Limites da malha inválidos');
    }
    return new Grid(min, max);
  }

  // RN02
  static standard(): Grid {
    return Grid.create(-15, 15);
  }

  contains(position: Position): boolean {
    return this.#inRange(position.x) && this.#inRange(position.y);
  }

  #inRange(value: number): boolean {
    return value >= this.min && value <= this.max;
  }
}

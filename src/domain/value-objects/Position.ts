export class Position {
  readonly x: number;
  readonly y: number;

  private constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    Object.freeze(this);
  }

  static create(x: number, y: number): Position {
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      throw new RangeError('As coordenadas devem ser números inteiros');
    }
    return new Position(x, y);
  }

  // RN01
  static origin(): Position {
    return new Position(0, 0);
  }

  equals(other: Position): boolean {
    return this.x === other.x && this.y === other.y;
  }

  translate(dx: number, dy: number): Position {
    return Position.create(this.x + dx, this.y + dy);
  }
}

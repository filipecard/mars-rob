import { NotAdjacentError } from '../errors/NotAdjacentError.js';
import { UnknownRobotError } from '../errors/UnknownRobotError.js';
import { shuffle, type Random } from '../services/random.js';
import type { Command } from '../value-objects/Command.js';
import type { Grid } from '../value-objects/Grid.js';
import type { Orientation } from '../value-objects/Orientation.js';
import { Position } from '../value-objects/Position.js';
import { Robot } from './Robot.js';

// RN13: 1 robô a cada 3 de limite (limite 15: 5 robôs; 18: 6; 21: 7), e pelo menos 1
export function maxRobots(limit: number): number {
  return Math.max(1, Math.floor(limit / 3));
}

export interface Placement {
  position: Position;
  orientation?: Orientation;
}

// RN13: o robô 1 nasce na origem; os outros, em casas livres sorteadas, sem nascer
// encostado (nem na diagonal) em outro robô
export function startingPositions(
  grid: Grid,
  count: number,
  random: Random,
): Position[] {
  const chosen = [Position.origin()];
  const free: Position[] = [];
  for (let x = grid.min; x <= grid.max; x++) {
    for (let y = grid.min; y <= grid.max; y++) {
      const cell = Position.create(x, y);
      if (!grid.isBlocked(cell)) {
        free.push(cell);
      }
    }
  }
  for (const cell of shuffle(free, random)) {
    if (chosen.length === count) {
      break;
    }
    if (chosen.every((other) => !touches(cell, other))) {
      chosen.push(cell);
    }
  }
  if (chosen.length < count) {
    throw new RangeError(
      `Não há espaço para ${String(count)} robôs sem que um encoste no outro`,
    );
  }
  return chosen;
}

// Mesma casa ou vizinha, inclusive na diagonal
function touches(a: Position, b: Position): boolean {
  return Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1;
}

// Agregado: os robôs da malha, identificados por ID (1, 2, 3...). Cada robô tem o próprio mapa (RN12).
export class Fleet {
  readonly grid: Grid;
  readonly #robots: ReadonlyMap<number, Robot>;

  private constructor(grid: Grid, robots: ReadonlyMap<number, Robot>) {
    this.grid = grid;
    this.#robots = robots;
  }

  // RN13: `count` robôs, de 1 a maxRobots(limite), olhando para o Norte
  static create(grid: Grid, count: number, random: Random): Fleet {
    const limit = (grid.max - grid.min) / 2;
    const max = maxRobots(limit);
    if (!Number.isInteger(count) || count < 1 || count > max) {
      throw new RangeError(
        `A quantidade de robôs deve ser um inteiro de 1 a ${String(max)} numa malha de limite ${String(limit)}`,
      );
    }
    return Fleet.place(
      grid,
      startingPositions(grid, count, random).map((position) => ({ position })),
    );
  }

  // Robôs em posições escolhidas (usado nos testes). O ID é a ordem na lista, a partir de 1.
  static place(grid: Grid, placements: readonly Placement[]): Fleet {
    if (placements.length < 1) {
      throw new RangeError('A frota precisa de pelo menos 1 robô');
    }
    const robots = new Map<number, Robot>();
    placements.forEach(({ position, orientation }, index) => {
      const taken = [...robots.values()].some((robot) =>
        robot.position.equals(position),
      );
      if (taken) {
        throw new RangeError('Dois robôs não podem começar na mesma posição');
      }
      robots.set(index + 1, Robot.create(grid, position, orientation));
    });
    return new Fleet(grid, robots);
  }

  get ids(): number[] {
    return [...this.#robots.keys()];
  }

  // RN14
  robot(id: number): Robot {
    const robot = this.#robots.get(id);
    if (robot === undefined) {
      throw new UnknownRobotError(id);
    }
    return robot;
  }

  // RN15: os outros robôs contam como obstáculo durante o comando
  move(id: number, command: Command): Robot {
    const robot = this.robot(id);
    robot.execute(command, (position) => this.#occupantAt(position, id));
    return robot;
  }

  // RN16: `from` envia o mapa para `to`, se estiverem lado a lado; devolve quantas casas eram novas
  shareMap(from: number, to: number): number {
    const sender = this.robot(from);
    const receiver = this.robot(to);
    if (!sender.isNextTo(receiver)) {
      throw new NotAdjacentError(from, to);
    }
    return receiver.receiveMap(sender.explored);
  }

  // ID do robô (diferente de `except`) que está na posição
  #occupantAt(position: Position, except: number): number | undefined {
    const id = this.robotAt(position);
    return id === except ? undefined : id;
  }

  // ID do robô que está na posição, ou undefined se a casa está vazia
  robotAt(position: Position): number | undefined {
    for (const [id, robot] of this.#robots) {
      if (robot.position.equals(position)) {
        return id;
      }
    }
    return undefined;
  }
}

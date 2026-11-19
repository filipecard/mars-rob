import type { Fleet } from '../entities/Fleet.js';
import type { Robot } from '../entities/Robot.js';
import type {
  CellInfo,
  Heading,
  RobotHost,
  SelfInfo,
  Side,
} from '../script/host.js';
import { step, type Direction } from '../value-objects/Direction.js';
import { toAbsolute, type Orientation } from '../value-objects/Orientation.js';
import { Position } from '../value-objects/Position.js';

const HEADINGS: Record<Orientation, Heading> = {
  N: 'north',
  L: 'east',
  S: 'south',
  O: 'west',
};

// RN03: frente, trás, direita e esquerda são as direções relativas N, S, L, O
const SIDES: Record<Side, Direction> = {
  front: 'N',
  back: 'S',
  right: 'L',
  left: 'O',
};

// RN18: os sensores do script de um robô, lidos da frota. O robô só sabe o que
// está na visão atual (RN12) ou no próprio mapa.
export class FleetRobotHost implements RobotHost {
  readonly #fleet: Fleet;
  readonly #id: number;
  readonly #print: (text: string) => void;

  constructor(fleet: Fleet, id: number, print: (text: string) => void) {
    this.#fleet = fleet;
    this.#id = id;
    this.#print = print;
  }

  get #robot(): Robot {
    return this.#fleet.robot(this.#id);
  }

  self(): SelfInfo {
    const { position, orientation } = this.#robot;
    return {
      id: this.#id,
      x: position.x,
      y: position.y,
      orientation: HEADINGS[orientation],
    };
  }

  look(side: Side): CellInfo {
    const { position, orientation } = this.#robot;
    return this.cellAt(
      ...coordinates(step(position, toAbsolute(orientation, SIDES[side]))),
    );
  }

  // Norte para cima: da linha de cima para a de baixo, da esquerda para a direita
  see(): CellInfo[] {
    const { position } = this.#robot;
    const cells: CellInfo[] = [];
    for (let dy = 1; dy >= -1; dy--) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx !== 0 || dy !== 0) {
          cells.push(this.cellAt(position.x + dx, position.y + dy));
        }
      }
    }
    return cells;
  }

  // RN12: na visão atual, o que há de fato; fora dela, o que o mapa do robô sabe
  // (sem os outros robôs, que podem ter saído do lugar)
  cellAt(x: number, y: number): CellInfo {
    const { grid } = this.#fleet;
    const robot = this.#robot;
    const position = Position.create(x, y);
    const cell = (type: CellInfo['type'], other: number | null = null) => ({
      type,
      x,
      y,
      robot: other,
    });
    if (!grid.contains(position)) {
      return cell('edge');
    }
    if (robot.canSee(position)) {
      const occupant = this.#fleet.robotAt(position);
      if (occupant !== undefined) {
        return cell('robot', occupant);
      }
    } else if (!robot.hasExplored(position)) {
      return cell('unknown');
    }
    return cell(grid.isBlocked(position) ? 'obstacle' : 'empty');
  }

  explored(): number {
    return this.#robot.explored.length;
  }

  print(text: string): void {
    this.#print(text);
  }
}

function coordinates({ x, y }: Position): [number, number] {
  return [x, y];
}

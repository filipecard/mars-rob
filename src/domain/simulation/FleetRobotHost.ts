import type { Fleet } from '../entities/Fleet.js';
import { VISION_RANGE, type Robot } from '../entities/Robot.js';
import type {
  CellInfo,
  Heading,
  RobotHost,
  SelfInfo,
  Side,
  StepKind,
} from '../script/host.js';
import { keyOf } from '../value-objects/Obstacle.js';
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
    if (!grid.contains(position)) {
      return {
        type: 'edge',
        x,
        y,
        robot: null,
        visited: false,
        unknownAround: 0,
      };
    }
    const cell = (
      type: CellInfo['type'],
      other: number | null = null,
    ): CellInfo => ({
      type,
      x,
      y,
      robot: other,
      visited: robot.hasVisited(position),
      unknownAround: this.#unknownAround(position),
    });
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

  // RN19: casas da malha no 3x3 em volta da casa que o robô ainda não conhece
  #unknownAround(center: Position): number {
    const { grid } = this.#fleet;
    const robot = this.#robot;
    let count = 0;
    for (let dx = -VISION_RANGE; dx <= VISION_RANGE; dx++) {
      for (let dy = -VISION_RANGE; dy <= VISION_RANGE; dy++) {
        const near = center.translate(dx, dy);
        if (grid.contains(near) && !robot.hasExplored(near)) {
          count++;
        }
      }
    }
    return count;
  }

  // RN21: busca em largura pela malha. Casa desconhecida conta como livre; não passa
  // por obstáculo que o robô conhece nem por robô que ele está vendo agora (a não ser
  // que seja o destino: aí ele vai até o lado e o último passo falha).
  pathTo(x: number, y: number): StepKind[] | null {
    const { grid } = this.#fleet;
    const robot = this.#robot;
    const target = Position.create(x, y);
    if (
      !grid.contains(target) ||
      (robot.hasExplored(target) && grid.isBlocked(target))
    ) {
      return null;
    }
    const passable = (cell: Position): boolean =>
      grid.contains(cell) &&
      !(robot.hasExplored(cell) && grid.isBlocked(cell)) &&
      (cell.equals(target) ||
        !robot.canSee(cell) ||
        this.#fleet.robotAt(cell) === undefined);

    const start = robot.position;
    const cameFrom = new Map<string, { from: Position; step: StepKind }>();
    const seen = new Set([keyOf(start)]);
    const queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i] as Position;
      if (current.equals(target)) {
        return this.#steps(cameFrom, start, target);
      }
      for (const [kind, direction] of STEPS) {
        const next = step(current, toAbsolute(robot.orientation, direction));
        if (!seen.has(keyOf(next)) && passable(next)) {
          seen.add(keyOf(next));
          cameFrom.set(keyOf(next), { from: current, step: kind });
          queue.push(next);
        }
      }
    }
    return null;
  }

  #steps(
    cameFrom: Map<string, { from: Position; step: StepKind }>,
    start: Position,
    target: Position,
  ): StepKind[] {
    const steps: StepKind[] = [];
    for (let at = target; !at.equals(start);) {
      const link = cameFrom.get(keyOf(at));
      if (link === undefined) {
        break;
      }
      steps.push(link.step);
      at = link.from;
    }
    return steps.reverse();
  }

  explored(): number {
    return this.#robot.explored.length;
  }

  print(text: string): void {
    this.#print(text);
  }
}

// Os passos sem giro e a direção relativa de cada um (RN03)
const STEPS: readonly [StepKind, Direction][] = [
  ['forward', 'N'],
  ['stepRight', 'L'],
  ['backward', 'S'],
  ['stepLeft', 'O'],
];

function coordinates({ x, y }: Position): [number, number] {
  return [x, y];
}

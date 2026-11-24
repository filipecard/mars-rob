import type { Fleet } from '../entities/Fleet.js';
import type { Robot } from '../entities/Robot.js';
import type {
  CellInfo,
  Heading,
  RobotHost,
  SelfInfo,
  Side,
  StatusInfo,
  StepKind,
  StorageInfo,
} from '../script/host.js';
import { keyOf, sideNeighbors } from '../value-objects/Obstacle.js';
import { step, type Direction } from '../value-objects/Direction.js';
import { toAbsolute, type Orientation } from '../value-objects/Orientation.js';
import { Position } from '../value-objects/Position.js';
import type { ItemKind } from '../world/Item.js';
import { checkUpgrade, upgradeLevels } from '../world/purchaseUpgrade.js';
import {
  isBlockingGround,
  type CellSnapshot,
  type Ground,
} from '../world/Terrain.js';
import type { UpgradeKind } from '../world/Upgrade.js';
import type { World } from '../world/World.js';

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
// está na visão atual (RN12) ou no próprio mapa, como estava quando ele viu (RN29).
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

  get #world(): World {
    return this.#fleet.world;
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
    const { position, visionRange } = this.#robot;
    const cells: CellInfo[] = [];
    for (let dy = visionRange; dy >= -visionRange; dy--) {
      for (let dx = -visionRange; dx <= visionRange; dx++) {
        if (dx !== 0 || dy !== 0) {
          cells.push(this.cellAt(position.x + dx, position.y + dy));
        }
      }
    }
    return cells;
  }

  // RN12: na visão atual, o que há de fato; fora dela, o que o mapa do robô lembra
  // (sem os outros robôs, que podem ter saído do lugar)
  cellAt(x: number, y: number): CellInfo {
    const robot = this.#robot;
    const position = Position.create(x, y);
    const info = (
      type: CellInfo['type'],
      seen: CellSnapshot | null,
      other: number | null = null,
    ): CellInfo => ({
      type,
      x,
      y,
      robot: other,
      visited: robot.hasVisited(position),
      unknownAround: type === 'edge' ? 0 : this.#unknownAround(position),
      item: seen?.item ?? null,
      obstacle:
        seen !== null && isBlockingGround(seen.ground)
          ? (seen.ground as 'rock' | 'tree' | 'ore')
          : null,
      isBase: seen?.ground === 'base',
    });
    if (!this.#world.contains(position)) {
      return info('edge', null);
    }
    if (robot.canSee(position)) {
      const seen = this.#world.describe(position);
      const occupant = this.#fleet.robotAt(position);
      if (occupant !== undefined) {
        return info('robot', seen, occupant);
      }
      return info(groundType(seen.ground), seen);
    }
    const remembered = robot.memoryOf(position);
    if (remembered === undefined) {
      return info('unknown', null);
    }
    return info(groundType(remembered.ground), remembered);
  }

  // RN19: casas da malha na visão em volta da casa que o robô ainda não conhece
  #unknownAround(center: Position): number {
    const robot = this.#robot;
    const range = robot.visionRange;
    let count = 0;
    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        const near = center.translate(dx, dy);
        if (this.#world.contains(near) && !robot.hasExplored(near)) {
          count++;
        }
      }
    }
    return count;
  }

  // RN21: menor caminho só pelo que o robô conhece. O destino precisa ser uma casa
  // conhecida e livre; não passa por obstáculo nem por casa desconhecida, e contorna
  // robôs que está vendo agora (a não ser no destino: aí ele vai até o lado e o último
  // passo falha).
  pathTo(x: number, y: number): StepKind[] | null {
    const target = Position.create(x, y);
    if (!this.#isKnownFree(target)) {
      return null;
    }
    const found = this.#search(
      (cell) => cell.equals(target),
      (cell) => cell.equals(target),
    );
    return found === null ? null : found.steps;
  }

  // O menor caminho até uma casa ao lado (sem diagonal) de (x, y)
  pathNextTo(x: number, y: number): StepKind[] | null {
    const target = Position.create(x, y);
    if (!this.#world.contains(target)) {
      return null;
    }
    const found = this.#search(
      (cell) => Math.abs(cell.x - x) + Math.abs(cell.y - y) === 1,
      () => false,
    );
    return found === null ? null : found.steps;
  }

  // RN22: a casa conhecida e livre mais próxima (em passos, pelo mapa do robô) de onde
  // ele vê alguma casa desconhecida. null se não há nenhuma ao alcance.
  nearestUnknown(): CellInfo | null {
    const found = this.#search(
      (cell) => this.#unknownAround(cell) > 0,
      () => false,
    );
    return found === null ? null : this.cellAt(found.cell.x, found.cell.y);
  }

  // RN25: a casa mais próxima onde o robô lembra de ter visto um item
  nearestItem(kind: ItemKind | null): CellInfo | null {
    const robot = this.#robot;
    const found = this.#search(
      (cell) => {
        const item = robot.memoryOf(cell)?.item ?? null;
        return item !== null && (kind === null || item === kind);
      },
      () => false,
    );
    return found === null ? null : this.cellAt(found.cell.x, found.cell.y);
  }

  // RN27: a jazida conhecida mais próxima, ao lado de uma casa que o robô alcança
  nearestOre(): CellInfo | null {
    const robot = this.#robot;
    const isOre = (cell: Position): boolean =>
      robot.memoryOf(cell)?.ground === 'ore';
    const found = this.#search(
      (cell) => sideNeighbors(cell).some(isOre),
      () => false,
    );
    const ore =
      found === null ? undefined : sideNeighbors(found.cell).find(isOre);
    return ore === undefined ? null : this.cellAt(ore.x, ore.y);
  }

  #isKnownFree(cell: Position): boolean {
    const seen = this.#robot.memoryOf(cell);
    return (
      this.#world.contains(cell) &&
      seen !== undefined &&
      !isBlockingGround(seen.ground)
    );
  }

  // Busca em largura a partir do robô, pelas casas conhecidas e livres, até a primeira
  // que satisfaz `isGoal`. `mayHaveRobot` diz onde um robô visível não impede a entrada.
  #search(
    isGoal: (cell: Position) => boolean,
    mayHaveRobot: (cell: Position) => boolean,
  ): { cell: Position; steps: StepKind[] } | null {
    const robot = this.#robot;
    const passable = (cell: Position): boolean =>
      this.#isKnownFree(cell) &&
      (mayHaveRobot(cell) ||
        !robot.canSee(cell) ||
        this.#fleet.robotAt(cell) === undefined);

    const start = robot.position;
    const cameFrom = new Map<string, { from: Position; step: StepKind }>();
    const seen = new Set([keyOf(start)]);
    const queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i] as Position;
      if (isGoal(current)) {
        return { cell: current, steps: this.#steps(cameFrom, start, current) };
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

  // RN24, RN25, RN28
  status(): StatusInfo {
    const robot = this.#robot;
    return {
      battery: robot.battery,
      maxBattery: robot.maxBattery,
      cargo: robot.cargo.used,
      maxCargo: robot.cargo.capacity,
      inventory: robot.cargo.list(),
      levels: upgradeLevels(this.#world, robot),
    };
  }

  base(): { x: number; y: number } {
    const { x, y } = this.#world.base;
    return { x, y };
  }

  warehouse(): StorageInfo {
    const { warehouse } = this.#world;
    return {
      items: warehouse.counts(),
      used: warehouse.used,
      capacity: warehouse.capacity,
    };
  }

  canUpgrade(kind: UpgradeKind): boolean {
    return checkUpgrade(this.#world, this.#robot, kind).ok;
  }

  print(text: string): void {
    this.#print(text);
  }
}

function groundType(ground: Ground): CellInfo['type'] {
  return isBlockingGround(ground) ? 'obstacle' : 'empty';
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

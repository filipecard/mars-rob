import { CollisionError } from '../errors/CollisionError.js';
import { ObstacleError } from '../errors/ObstacleError.js';
import { OutOfGridError } from '../errors/OutOfGridError.js';
import type { Command } from '../value-objects/Command.js';
import { step } from '../value-objects/Direction.js';
import { keyOf } from '../value-objects/Obstacle.js';
import {
  isTurn,
  toAbsolute,
  turn,
  type Orientation,
} from '../value-objects/Orientation.js';
import { Position } from '../value-objects/Position.js';
import { Inventory } from '../world/Inventory.js';
import type { ItemCounts } from '../world/Item.js';
import type { CellSnapshot, Ground, Terrain } from '../world/Terrain.js';
import {
  BATTERY_PER_LEVEL,
  CARGO_PER_LEVEL,
  VISION_PER_LEVEL,
  type RobotUpgrade,
} from '../world/Upgrade.js';

// RN12: o robô enxerga a casa onde está e 1 casa em todas as direções (inclusive
// diagonais). A melhoria de visão (RN28) aumenta esse alcance.
export const VISION_RANGE = 1;

// RN15: o ID do robô que ocupa a posição, ou undefined se ela está vazia
export type OccupantLookup = (position: Position) => number | undefined;

// RN24, RN25: números do robô
export interface RobotSettings {
  // Carga máxima sem melhorias
  battery: number;
  // Espaço do compartimento sem melhorias
  cargo: number;
  // Carga que recharge() devolve por tick, na base
  rechargeRate: number;
  // Painel solar: sem gastar carga, ganha 1 a cada N ticks (0: nunca)
  solarEvery: number;
}

export const DEFAULT_ROBOT_SETTINGS: RobotSettings = {
  battery: 100,
  cargo: 5,
  rechargeRate: 20,
  solarEvery: 5,
};

export type RobotLevels = Record<RobotUpgrade, number>;

// Uma casa do mapa do robô: onde fica e como estava quando ele a viu
export interface MemoryEntry {
  position: Position;
  seen: CellSnapshot;
}

// Para salvar e carregar (RN30)
export interface RobotSnapshot {
  x: number;
  y: number;
  orientation: Orientation;
  battery: number;
  solar: number;
  cargo: ItemCounts;
  levels: RobotLevels;
  explored: {
    x: number;
    y: number;
    ground: Ground;
    item: CellSnapshot['item'];
  }[];
  visited: [number, number][];
}

export class Robot {
  readonly terrain: Terrain;
  readonly settings: RobotSettings;
  #position: Position;
  #orientation: Orientation;
  // RN12, RN29: o que o robô viu em cada casa, pela chave "x,y". O mundo muda:
  // fora da visão, o mapa mostra como a casa estava da última vez.
  readonly #explored = new Map<string, MemoryEntry>();
  // RN19: casas onde o robô já esteve (a inicial e cada passo dado)
  readonly #visited = new Set<string>();
  // RN24
  #battery: number;
  #solar = 0;
  #spent = false;
  // RN25
  readonly cargo: Inventory;
  readonly #levels: RobotLevels = {
    pickaxe: 0,
    axe: 0,
    battery: 0,
    cargo: 0,
    vision: 0,
  };

  private constructor(
    terrain: Terrain,
    position: Position,
    orientation: Orientation,
    settings: RobotSettings,
  ) {
    this.terrain = terrain;
    this.settings = settings;
    this.#position = position;
    this.#orientation = orientation;
    this.#battery = settings.battery;
    this.cargo = new Inventory(settings.cargo);
    this.#visited.add(keyOf(position));
    this.#lookAround(position);
  }

  // RN01
  static create(
    terrain: Terrain,
    position: Position = Position.origin(),
    orientation: Orientation = 'N',
    settings: RobotSettings = DEFAULT_ROBOT_SETTINGS,
  ): Robot {
    if (!terrain.contains(position)) {
      throw new OutOfGridError(position);
    }
    if (terrain.isBlocked(position)) {
      throw new ObstacleError(position);
    }
    return new Robot(terrain, position, orientation, settings);
  }

  static restore(
    terrain: Terrain,
    snapshot: RobotSnapshot,
    settings: RobotSettings,
  ): Robot {
    const robot = new Robot(
      terrain,
      Position.create(snapshot.x, snapshot.y),
      snapshot.orientation,
      settings,
    );
    for (const [kind, level] of Object.entries(snapshot.levels)) {
      for (let i = 0; i < level; i++) {
        robot.applyUpgrade(kind as RobotUpgrade);
      }
    }
    robot.#battery = Math.min(snapshot.battery, robot.maxBattery);
    robot.#solar = snapshot.solar;
    for (const [kind, count] of Object.entries(snapshot.cargo)) {
      for (let i = 0; i < count; i++) {
        robot.cargo.add(kind as keyof ItemCounts);
      }
    }
    robot.#explored.clear();
    for (const { x, y, ground, item } of snapshot.explored) {
      const position = Position.create(x, y);
      robot.#explored.set(keyOf(position), {
        position,
        seen: { ground, item },
      });
    }
    robot.#visited.clear();
    for (const [x, y] of snapshot.visited) {
      robot.#visited.add(keyOf({ x, y }));
    }
    return robot;
  }

  snapshot(): RobotSnapshot {
    return {
      x: this.#position.x,
      y: this.#position.y,
      orientation: this.#orientation,
      battery: this.#battery,
      solar: this.#solar,
      cargo: this.cargo.counts(),
      levels: this.levels,
      explored: this.memory().map(({ position, seen }) => ({
        x: position.x,
        y: position.y,
        ...seen,
      })),
      visited: [...this.#visited].map((key) => {
        const [x = 0, y = 0] = key.split(',').map(Number);
        return [x, y];
      }),
    };
  }

  get position(): Position {
    return this.#position;
  }

  get orientation(): Orientation {
    return this.#orientation;
  }

  // RN12: casas já vistas, na ordem em que foram descobertas
  get explored(): readonly Position[] {
    return [...this.#explored.values()].map((entry) => entry.position);
  }

  // O mapa do robô: cada casa conhecida e como ele a viu
  memory(): MemoryEntry[] {
    return [...this.#explored.values()];
  }

  hasExplored(position: Position): boolean {
    return this.#explored.has(keyOf(position));
  }

  // Como o robô lembra da casa (undefined se nunca a viu)
  memoryOf(position: Position): CellSnapshot | undefined {
    return this.#explored.get(keyOf(position))?.seen;
  }

  // RN19: o robô já esteve na casa (ver não basta)
  hasVisited(position: Position): boolean {
    return this.#visited.has(keyOf(position));
  }

  // RN12/RN28: alcance da visão (1 = 3x3; 2 = 5x5)
  get visionRange(): number {
    return VISION_RANGE + this.#levels.vision * VISION_PER_LEVEL;
  }

  // RN12: a casa está dentro da visão atual
  canSee(position: Position): boolean {
    return (
      Math.abs(position.x - this.position.x) <= this.visionRange &&
      Math.abs(position.y - this.position.y) <= this.visionRange
    );
  }

  // RN16: soma ao mapa as casas recebidas de outro robô; devolve quantas eram novas
  receiveMap(entries: readonly MemoryEntry[]): number {
    let added = 0;
    for (const { position, seen } of entries) {
      if (this.terrain.contains(position) && !this.hasExplored(position)) {
        this.#explored.set(keyOf(position), { position, seen: { ...seen } });
        added++;
      }
    }
    return added;
  }

  // RN20: apaga o mapa e as casas visitadas. O robô continua onde está, então volta a
  // conhecer a própria casa (visitada) e a visão em volta, como ao nascer.
  // Devolve quantas casas ele deixou de conhecer.
  forgetMap(): number {
    const before = this.#explored.size;
    this.#explored.clear();
    this.#visited.clear();
    this.#visited.add(keyOf(this.#position));
    this.#lookAround(this.#position);
    return before - this.#explored.size;
  }

  // RN16: vizinho pelos lados (sem diagonal)
  isNextTo(other: Robot): boolean {
    const dx = Math.abs(this.position.x - other.position.x);
    const dy = Math.abs(this.position.y - other.position.y);
    return dx + dy === 1;
  }

  // RN29: o mundo mudou; o robô atualiza o que está vendo agora
  refreshView(): void {
    this.#lookAround(this.#position);
  }

  // Executa as instruções na ordem: cada passo usa a orientação deixada pelos giros anteriores.
  // RN04/RN09/RN15: valida limite, obstáculo e outros robôs a cada passo.
  // RN05: só atualiza posição, orientação e exploração se todos os passos forem válidos.
  execute(
    command: Command,
    occupantAt: OccupantLookup = () => undefined,
  ): void {
    let position = this.#position;
    let orientation = this.#orientation;
    const path: Position[] = [];
    for (const instruction of command.instructions) {
      if (isTurn(instruction)) {
        orientation = turn(orientation, instruction);
        continue;
      }
      position = step(position, toAbsolute(orientation, instruction));
      if (!this.terrain.contains(position)) {
        throw new OutOfGridError(position);
      }
      if (this.terrain.isBlocked(position)) {
        throw new ObstacleError(position);
      }
      const occupant = occupantAt(position);
      if (occupant !== undefined) {
        throw new CollisionError(position, occupant);
      }
      path.push(position);
    }
    this.#position = position;
    this.#orientation = orientation;
    // RN12: revela a vizinhança de cada casa do caminho, não só a do destino
    for (const visited of path) {
      this.#visited.add(keyOf(visited));
      this.#lookAround(visited);
    }
  }

  // --- bateria (RN24)

  get battery(): number {
    return this.#battery;
  }

  get maxBattery(): number {
    return this.settings.battery + this.#levels.battery * BATTERY_PER_LEVEL;
  }

  canAfford(cost: number): boolean {
    return this.#battery >= cost;
  }

  // Gasta a carga; devolve false (sem gastar) se não houver o bastante
  spend(cost: number): boolean {
    if (!this.canAfford(cost)) {
      return false;
    }
    if (cost > 0) {
      this.#battery -= cost;
      this.#spent = true;
    }
    return true;
  }

  // Na base: devolve quanta carga entrou
  recharge(): number {
    const added = Math.min(
      this.settings.rechargeRate,
      this.maxBattery - this.#battery,
    );
    this.#battery += added;
    return added;
  }

  // Fim do tick: o painel solar carrega quem não gastou nada
  endTick(): void {
    const { solarEvery } = this.settings;
    if (!this.#spent && solarEvery > 0 && this.#battery < this.maxBattery) {
      this.#solar++;
      if (this.#solar >= solarEvery) {
        this.#battery++;
        this.#solar = 0;
      }
    }
    this.#spent = false;
  }

  // --- melhorias (RN28)

  get levels(): RobotLevels {
    return { ...this.#levels };
  }

  get hasPickaxe(): boolean {
    return this.#levels.pickaxe > 0;
  }

  get pickaxeLevel(): number {
    return this.#levels.pickaxe;
  }

  get hasAxe(): boolean {
    return this.#levels.axe > 0;
  }

  get axeLevel(): number {
    return this.#levels.axe;
  }

  // Aplica a melhoria e devolve o novo nível (quem cobra e valida é purchaseUpgrade)
  applyUpgrade(kind: RobotUpgrade): number {
    this.#levels[kind]++;
    if (kind === 'cargo') {
      this.cargo.grow(CARGO_PER_LEVEL);
    }
    if (kind === 'vision') {
      this.refreshView();
    }
    return this.#levels[kind];
  }

  #lookAround(center: Position): void {
    const range = this.visionRange;
    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        const seen = center.translate(dx, dy);
        if (this.terrain.contains(seen)) {
          this.#explored.set(keyOf(seen), {
            position: seen,
            seen: this.terrain.describe(seen),
          });
        }
      }
    }
  }
}

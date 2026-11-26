import type { Fleet } from '../domain/entities/Fleet.js';
import type { Robot } from '../domain/entities/Robot.js';
import type {
  Simulation,
  SimulationEvent,
} from '../domain/simulation/Simulation.js';
import type { Position } from '../domain/value-objects/Position.js';
import type { Inventory } from '../domain/world/Inventory.js';
import { ITEM_KINDS, ITEM_SIZES } from '../domain/world/Item.js';
import {
  checkUpgrade,
  upgradeLevels,
} from '../domain/world/purchaseUpgrade.js';
import {
  UPGRADE_KINDS,
  UPGRADES,
  upgradeCost,
} from '../domain/world/Upgrade.js';
import type { World } from '../domain/world/World.js';

// DTOs: dados simples que saem da aplicação. A apresentação não pode importar o domínio.

// Espelha a Orientation do domínio
export type OrientationDTO = 'N' | 'L' | 'S' | 'O';

// RN25: galho, pedra, tronco e minério de ferro
export type ItemDTO = 'branch' | 'stone' | 'log' | 'iron';

// RN28: picareta, bateria, compartimento, visão e armazém
export type UpgradeDTO =
  'pickaxe' | 'battery' | 'cargo' | 'vision' | 'warehouse';

export type GroundDTO = 'free' | 'base' | 'rock' | 'tree' | 'ore' | 'sand' | 'ice';

export type ItemCountsDTO = Record<ItemDTO, number>;

export const ITEM_LIST: readonly ItemDTO[] = ITEM_KINDS;
export const ITEM_SPACE: Readonly<Record<ItemDTO, number>> = ITEM_SIZES;
export const UPGRADE_LIST: readonly UpgradeDTO[] = UPGRADE_KINDS;

export interface PositionDTO {
  x: number;
  y: number;
}

export interface RobotStateDTO extends PositionDTO {
  id: number;
  orientation: OrientationDTO;
}

// RN12, RN29: uma casa do mapa do robô, como ele a viu da última vez
export interface CellDTO extends PositionDTO {
  blocked: boolean;
  // RN19: o robô já esteve nesta casa (e não só a viu)
  visited: boolean;
  ground: GroundDTO;
  item: ItemDTO | null;
}

// Resumo da malha. RN13: diz quantos robôs há, mas não onde estão.
export interface FleetDTO {
  min: number;
  max: number;
  obstacleCount: number;
  robotCount: number;
}

// RN12: o mapa de um robô mostra só o que ele já viu (ou recebeu de outro robô, RN16).
// `others`: só os outros robôs que este robô está vendo agora. Um robô não sabe
// onde o outro está até encontrá-lo.
export interface MapDTO {
  min: number;
  max: number;
  explored: CellDTO[];
  robot: RobotStateDTO;
  others: RobotStateDTO[];
  // RN23
  base: PositionDTO;
  // RN12/RN28: 1 = 3x3, 2 = 5x5
  visionRange: number;
}

// RN25: compartimento do robô ou armazém da base
export interface StorageDTO {
  items: ItemCountsDTO;
  used: number;
  capacity: number;
}

export type UpgradeFailureDTO = 'notAtBase' | 'maxLevel' | 'missing';

// RN28: uma melhoria vista por um robô: nível atual, custo do próximo e se dá para fazer agora
export interface UpgradeOfferDTO {
  upgrade: UpgradeDTO;
  level: number;
  maxLevel: number;
  // null: já está no nível máximo
  cost: ItemCountsDTO | null;
  // Custos de todos os níveis, para a interface explicar os requisitos futuros.
  costs: { level: number; items: ItemCountsDTO }[];
  available: boolean;
  reason: UpgradeFailureDTO | null;
}

export function toPositionDTO({ x, y }: Position): PositionDTO {
  return { x, y };
}

export function toRobotStateDTO(id: number, robot: Robot): RobotStateDTO {
  return {
    id,
    ...toPositionDTO(robot.position),
    orientation: robot.orientation,
  };
}

export function toFleetDTO(fleet: Fleet): FleetDTO {
  const { world } = fleet;
  return {
    min: world.min,
    max: world.max,
    obstacleCount: world.grid.obstacles.length,
    robotCount: fleet.ids.length,
  };
}

export function toMapDTO(fleet: Fleet, id: number): MapDTO {
  const { world } = fleet;
  const robot = fleet.robot(id);
  return {
    min: world.min,
    max: world.max,
    explored: robot.memory().map(({ position, seen }) => ({
      ...toPositionDTO(position),
      blocked:
        seen.ground === 'rock' ||
        seen.ground === 'tree' ||
        seen.ground === 'ore',
      visited: robot.hasVisited(position),
      ground: seen.ground,
      item: seen.item,
    })),
    robot: toRobotStateDTO(id, robot),
    others: fleet.ids
      .filter(
        (other) => other !== id && robot.canSee(fleet.robot(other).position),
      )
      .map((other) => toRobotStateDTO(other, fleet.robot(other))),
    base: toPositionDTO(world.base),
    visionRange: robot.visionRange,
  };
}

export function toStorageDTO(inventory: Inventory): StorageDTO {
  return {
    items: inventory.counts(),
    used: inventory.used,
    capacity: inventory.capacity,
  };
}

export function toUpgradeOffers(world: World, robot: Robot): UpgradeOfferDTO[] {
  const levels = upgradeLevels(world, robot);
  return UPGRADE_KINDS.map((upgrade) => {
    const level = levels[upgrade];
    const { maxLevel } = UPGRADES[upgrade];
    const check = checkUpgrade(world, robot, upgrade);
    return {
      upgrade,
      level,
      maxLevel,
      cost: level < maxLevel ? upgradeCost(upgrade, level + 1) : null,
      costs: Array.from({ length: maxLevel }, (_, index) => ({
        level: index + 1,
        items: upgradeCost(upgrade, index + 1),
      })),
      available: check.ok,
      reason: check.ok ? null : check.reason,
    };
  });
}

// RN17: o que aconteceu com um robô num tick (espelha SimulationEvent, com posições simples)
export type EventDTO = { tick: number; robot: number } & (
  | { kind: 'moved'; position: PositionDTO; orientation: OrientationDTO }
  | { kind: 'turned'; position: PositionDTO; orientation: OrientationDTO }
  | { kind: 'waited' }
  | {
      kind: 'blocked';
      reason: 'edge' | 'obstacle' | 'robot';
      at: PositionDTO;
      other: number | null;
    }
  | { kind: 'shared'; to: number; added: number }
  | {
      kind: 'shareFailed';
      to: number;
      reason: 'notAdjacent' | 'unknownRobot' | 'self';
    }
  | { kind: 'forgot'; forgotten: number }
  | { kind: 'recharged'; added: number; battery: number }
  | { kind: 'collected'; item: ItemDTO }
  | { kind: 'unloaded'; count: number }
  | { kind: 'mined'; item: ItemDTO; at: PositionDTO; depleted: boolean }
  | { kind: 'upgraded'; upgrade: UpgradeDTO; level: number }
  | { kind: 'failed'; action: ActionDTO; reason: FailReasonDTO }
  | { kind: 'printed'; text: string }
  | { kind: 'finished' }
  | { kind: 'error'; message: string; line: number; column: number }
);

export type ActionDTO =
  | 'forward'
  | 'backward'
  | 'stepRight'
  | 'stepLeft'
  | 'turnRight'
  | 'turnLeft'
  | 'wait'
  | 'shareMap'
  | 'forgetMap'
  | 'recharge'
  | 'collect'
  | 'unload'
  | 'mine'
  | 'upgrade';

export type FailReasonDTO =
  | 'noBattery'
  | 'notAtBase'
  | 'nothing'
  | 'full'
  | 'empty'
  | 'noTool'
  | 'maxLevel'
  | 'missing';

export type ProgramKindDTO = 'orders' | 'script';

export interface RobotStatusDTO {
  id: number;
  // null: o robô está parado, sem programa
  program: ProgramKindDTO | null;
  map: MapDTO;
  // RN24
  battery: number;
  maxBattery: number;
  // RN25
  cargo: StorageDTO;
  // RN23
  atBase: boolean;
  // RN28
  upgrades: UpgradeOfferDTO[];
}

// Tudo o que o frontend desenha: o relógio, a malha, o armazém e cada robô
export interface SimulationDTO {
  tick: number;
  fleet: FleetDTO;
  // RN25
  warehouse: StorageDTO;
  robots: RobotStatusDTO[];
}

export function toEventDTO(event: SimulationEvent): EventDTO {
  switch (event.kind) {
    case 'moved':
    case 'turned':
      return { ...event, position: toPositionDTO(event.position) };
    case 'blocked':
    case 'mined':
      return { ...event, at: toPositionDTO(event.at) };
    default:
      return { ...event };
  }
}

export function toRobotStatusDTO(
  simulation: Simulation,
  id: number,
): RobotStatusDTO {
  const { fleet, world } = simulation;
  const robot = fleet.robot(id);
  return {
    id,
    program: simulation.programOf(id),
    map: toMapDTO(fleet, id),
    battery: robot.battery,
    maxBattery: robot.maxBattery,
    cargo: toStorageDTO(robot.cargo),
    atBase: world.isBase(robot.position),
    upgrades: toUpgradeOffers(world, robot),
  };
}

export function toSimulationDTO(simulation: Simulation): SimulationDTO {
  const { fleet, world } = simulation;
  return {
    tick: simulation.tick,
    fleet: toFleetDTO(fleet),
    warehouse: toStorageDTO(world.warehouse),
    robots: fleet.ids.map((id) => toRobotStatusDTO(simulation, id)),
  };
}

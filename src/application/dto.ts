import type { Fleet } from '../domain/entities/Fleet.js';
import type { Robot } from '../domain/entities/Robot.js';
import type {
  Simulation,
  SimulationEvent,
} from '../domain/simulation/Simulation.js';
import type { Position } from '../domain/value-objects/Position.js';

// DTOs: dados simples que saem da aplicação. A apresentação não pode importar o domínio.

// Espelha a Orientation do domínio
export type OrientationDTO = 'N' | 'L' | 'S' | 'O';

export interface PositionDTO {
  x: number;
  y: number;
}

export interface RobotStateDTO extends PositionDTO {
  id: number;
  orientation: OrientationDTO;
}

export interface CellDTO extends PositionDTO {
  blocked: boolean;
}

// Resumo da malha. RN13: diz quantos robôs há, mas não onde estão.
export interface FleetDTO {
  min: number;
  max: number;
  obstacleCount: number;
  robotCount: number;
}

// RN12: o mapa de um robô mostra só o que ele já viu (ou recebeu de outro robô, RN16).
// `others`: só os outros robôs que este robô está vendo agora (visão 3x3). Um robô
// não sabe onde o outro está até encontrá-lo.
export interface MapDTO {
  min: number;
  max: number;
  explored: CellDTO[];
  robot: RobotStateDTO;
  others: RobotStateDTO[];
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
  const { grid } = fleet;
  return {
    min: grid.min,
    max: grid.max,
    obstacleCount: grid.obstacles.length,
    robotCount: fleet.ids.length,
  };
}

export function toMapDTO(fleet: Fleet, id: number): MapDTO {
  const { grid } = fleet;
  const robot = fleet.robot(id);
  return {
    min: grid.min,
    max: grid.max,
    explored: robot.explored.map((cell) => ({
      ...toPositionDTO(cell),
      blocked: grid.isBlocked(cell),
    })),
    robot: toRobotStateDTO(id, robot),
    others: fleet.ids
      .filter(
        (other) => other !== id && robot.canSee(fleet.robot(other).position),
      )
      .map((other) => toRobotStateDTO(other, fleet.robot(other))),
  };
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
  | { kind: 'printed'; text: string }
  | { kind: 'finished' }
  | { kind: 'error'; message: string; line: number; column: number }
);

export type ProgramKindDTO = 'orders' | 'script';

export interface RobotStatusDTO {
  id: number;
  // null: o robô está parado, sem programa
  program: ProgramKindDTO | null;
  map: MapDTO;
}

// Tudo o que o frontend desenha: o relógio, a malha e o mapa de cada robô
export interface SimulationDTO {
  tick: number;
  fleet: FleetDTO;
  robots: RobotStatusDTO[];
}

export function toEventDTO(event: SimulationEvent): EventDTO {
  switch (event.kind) {
    case 'moved':
    case 'turned':
      return { ...event, position: toPositionDTO(event.position) };
    case 'blocked':
      return { ...event, at: toPositionDTO(event.at) };
    default:
      return { ...event };
  }
}

export function toSimulationDTO(simulation: Simulation): SimulationDTO {
  const { fleet } = simulation;
  return {
    tick: simulation.tick,
    fleet: toFleetDTO(fleet),
    robots: fleet.ids.map((id) => ({
      id,
      program: simulation.programOf(id),
      map: toMapDTO(fleet, id),
    })),
  };
}

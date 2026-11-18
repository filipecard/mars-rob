import type { Fleet } from '../domain/entities/Fleet.js';
import type { Robot } from '../domain/entities/Robot.js';
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

import type { Robot } from '../domain/entities/Robot.js';
import type { Grid } from '../domain/value-objects/Grid.js';
import type { Position } from '../domain/value-objects/Position.js';

// DTOs: dados simples que saem da aplicação. A apresentação não pode importar o domínio.

// Espelha a Orientation do domínio
export type OrientationDTO = 'N' | 'L' | 'S' | 'O';

export interface PositionDTO {
  x: number;
  y: number;
}

export interface RobotStateDTO extends PositionDTO {
  orientation: OrientationDTO;
}

export interface CellDTO extends PositionDTO {
  blocked: boolean;
}

// RN12: só o que o robô já viu. O resto da malha é desconhecido para quem está de fora.
export interface GridDTO {
  min: number;
  max: number;
  obstacleCount: number;
  explored: CellDTO[];
  robot: RobotStateDTO;
}

export function toPositionDTO({ x, y }: Position): PositionDTO {
  return { x, y };
}

export function toRobotStateDTO(robot: Robot): RobotStateDTO {
  return { ...toPositionDTO(robot.position), orientation: robot.orientation };
}

export function toGridDTO(grid: Grid, robot: Robot): GridDTO {
  return {
    min: grid.min,
    max: grid.max,
    obstacleCount: grid.obstacles.length,
    explored: robot.explored.map((cell) => ({
      ...toPositionDTO(cell),
      blocked: grid.isBlocked(cell),
    })),
    robot: toRobotStateDTO(robot),
  };
}

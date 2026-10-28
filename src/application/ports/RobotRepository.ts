import type { Robot } from '../../domain/entities/Robot.js';

export interface RobotRepository {
  get(): Promise<Robot>;
  save(robot: Robot): Promise<void>;
}

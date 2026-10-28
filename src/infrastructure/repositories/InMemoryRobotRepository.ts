import type { RobotRepository } from '../../application/ports/RobotRepository.js';
import { Robot } from '../../domain/entities/Robot.js';
import { Grid } from '../../domain/value-objects/Grid.js';

export class InMemoryRobotRepository implements RobotRepository {
  #robot: Robot;

  constructor(robot: Robot = Robot.create(Grid.standard())) {
    this.#robot = robot;
  }

  get(): Promise<Robot> {
    return Promise.resolve(this.#robot);
  }

  save(robot: Robot): Promise<void> {
    this.#robot = robot;
    return Promise.resolve();
  }
}

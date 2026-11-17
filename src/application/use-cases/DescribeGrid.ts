import { toGridDTO, type GridDTO } from '../dto.js';
import type { RobotRepository } from '../ports/RobotRepository.js';

// Devolve a malha, os obstáculos e o robô para a apresentação desenhar o mapa
export class DescribeGrid {
  readonly #robots: RobotRepository;

  constructor(robots: RobotRepository) {
    this.#robots = robots;
  }

  async execute(): Promise<GridDTO> {
    const robot = await this.#robots.get();
    return toGridDTO(robot.grid, robot);
  }
}

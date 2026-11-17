import { UnknownRobotError } from '../../domain/errors/UnknownRobotError.js';
import { toMapDTO, type MapDTO } from '../dto.js';
import type { FleetRepository } from '../ports/FleetRepository.js';

export type DescribeMapResult =
  | { ok: true; map: MapDTO }
  | { ok: false; error: 'UNKNOWN_ROBOT'; robotId: number };

// RN12: o mapa de um robô, para a apresentação desenhar
export class DescribeMap {
  readonly #fleets: FleetRepository;

  constructor(fleets: FleetRepository) {
    this.#fleets = fleets;
  }

  async execute(robotId: number): Promise<DescribeMapResult> {
    const fleet = await this.#fleets.get();
    try {
      return { ok: true, map: toMapDTO(fleet, robotId) };
    } catch (error) {
      if (error instanceof UnknownRobotError) {
        return { ok: false, error: 'UNKNOWN_ROBOT', robotId };
      }
      throw error;
    }
  }
}

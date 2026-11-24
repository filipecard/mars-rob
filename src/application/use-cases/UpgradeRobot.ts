import { UnknownRobotError } from '../../domain/errors/UnknownRobotError.js';
import { isUpgradeKind } from '../../domain/world/Upgrade.js';
import type { ItemCountsDTO, UpgradeDTO, UpgradeFailureDTO } from '../dto.js';
import type { SimulationRepository } from '../ports/SimulationRepository.js';

export type UpgradeResult =
  | { ok: true; upgrade: UpgradeDTO; level: number }
  | { ok: false; error: 'UNKNOWN_ROBOT'; robotId: number }
  | { ok: false; error: 'UNKNOWN_UPGRADE'; upgrade: string }
  | {
      ok: false;
      error: 'UPGRADE_FAILED';
      upgrade: UpgradeDTO;
      reason: UpgradeFailureDTO;
      // reason 'missing': o que falta no armazém
      missing: ItemCountsDTO | null;
    };

// RN28: o operador faz uma melhoria, com o robô na base. Não gasta tick.
export class UpgradeRobot {
  readonly #simulations: SimulationRepository;

  constructor(simulations: SimulationRepository) {
    this.#simulations = simulations;
  }

  async execute(robotId: number, upgrade: string): Promise<UpgradeResult> {
    if (!isUpgradeKind(upgrade)) {
      return { ok: false, error: 'UNKNOWN_UPGRADE', upgrade };
    }
    const simulation = await this.#simulations.get();
    try {
      const result = simulation.upgrade(robotId, upgrade);
      await this.#simulations.save(simulation);
      return result.ok
        ? { ok: true, upgrade, level: result.level }
        : {
            ok: false,
            error: 'UPGRADE_FAILED',
            upgrade,
            reason: result.reason,
            missing: result.missing,
          };
    } catch (error) {
      if (error instanceof UnknownRobotError) {
        return { ok: false, error: 'UNKNOWN_ROBOT', robotId };
      }
      throw error;
    }
  }
}

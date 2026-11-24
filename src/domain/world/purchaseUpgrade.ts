import type { Robot } from '../entities/Robot.js';
import type { ItemCounts } from './Item.js';
import {
  UPGRADES,
  upgradeCost,
  type UpgradeKind,
  type UpgradeLevels,
} from './Upgrade.js';
import type { World } from './World.js';

export type UpgradeFailure = 'notAtBase' | 'maxLevel' | 'missing';

export type UpgradeCheck =
  | { ok: true; level: number; cost: ItemCounts }
  | { ok: false; reason: UpgradeFailure; missing: ItemCounts | null };

// Os níveis do robô junto com o do armazém (que é da base)
export function upgradeLevels(world: World, robot: Robot): UpgradeLevels {
  return { ...robot.levels, warehouse: world.warehouseLevel };
}

// RN28: a melhoria pode ser feita? O robô precisa estar na base, a melhoria não pode
// estar no nível máximo e o armazém precisa ter os itens do próximo nível.
export function checkUpgrade(
  world: World,
  robot: Robot,
  kind: UpgradeKind,
): UpgradeCheck {
  if (!world.isBase(robot.position)) {
    return { ok: false, reason: 'notAtBase', missing: null };
  }
  const level = upgradeLevels(world, robot)[kind] + 1;
  if (level > UPGRADES[kind].maxLevel) {
    return { ok: false, reason: 'maxLevel', missing: null };
  }
  const cost = upgradeCost(kind, level);
  if (!world.warehouse.has(cost)) {
    return {
      ok: false,
      reason: 'missing',
      missing: world.warehouse.missing(cost),
    };
  }
  return { ok: true, level, cost };
}

// RN28: cobra do armazém e aplica a melhoria
export function purchaseUpgrade(
  world: World,
  robot: Robot,
  kind: UpgradeKind,
): UpgradeCheck {
  const check = checkUpgrade(world, robot, kind);
  if (!check.ok) {
    return check;
  }
  world.warehouse.take(check.cost);
  if (kind === 'warehouse') {
    world.upgradeWarehouse();
  } else {
    robot.applyUpgrade(kind);
  }
  return check;
}

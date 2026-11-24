import { ITEM_KINDS, noItems, type ItemCounts } from './Item.js';

// RN28: melhorias feitas na base com os itens do armazém
export const UPGRADE_KINDS = [
  'pickaxe',
  'battery',
  'cargo',
  'vision',
  'warehouse',
] as const;

export type UpgradeKind = (typeof UPGRADE_KINDS)[number];

// As que ficam no robô (o armazém é da base)
export type RobotUpgrade = Exclude<UpgradeKind, 'warehouse'>;

export interface UpgradeSpec {
  maxLevel: number;
  // Custo do nível 1; o nível n custa n vezes isso
  cost: Partial<ItemCounts>;
}

export const UPGRADES: Readonly<Record<UpgradeKind, UpgradeSpec>> = {
  pickaxe: { maxLevel: 1, cost: { branch: 3, stone: 2 } },
  battery: { maxLevel: 3, cost: { iron: 4, log: 2 } },
  cargo: { maxLevel: 3, cost: { log: 3, iron: 2 } },
  vision: { maxLevel: 1, cost: { iron: 6 } },
  warehouse: { maxLevel: 3, cost: { log: 6, stone: 4 } },
};

// Quanto cada nível acrescenta
export const BATTERY_PER_LEVEL = 50;
export const CARGO_PER_LEVEL = 5;
export const WAREHOUSE_PER_LEVEL = 50;
export const VISION_PER_LEVEL = 1;

export function isUpgradeKind(value: string): value is UpgradeKind {
  return (UPGRADE_KINDS as readonly string[]).includes(value);
}

// Custo para chegar ao nível `level` (1, 2, 3...)
export function upgradeCost(kind: UpgradeKind, level: number): ItemCounts {
  const cost = noItems();
  for (const item of ITEM_KINDS) {
    cost[item] = (UPGRADES[kind].cost[item] ?? 0) * level;
  }
  return cost;
}

export type UpgradeLevels = Record<UpgradeKind, number>;

export function noUpgrades(): UpgradeLevels {
  return { pickaxe: 0, battery: 0, cargo: 0, vision: 0, warehouse: 0 };
}

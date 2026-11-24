// RN25: itens que ficam no chão e ocupam espaço no armazenamento
export const ITEM_KINDS = ['branch', 'stone', 'log', 'iron'] as const;

export type ItemKind = (typeof ITEM_KINDS)[number];

// Quanto espaço cada item ocupa no compartimento do robô e no armazém
export const ITEM_SIZES: Readonly<Record<ItemKind, number>> = {
  branch: 1,
  stone: 2,
  log: 4,
  iron: 3,
};

export type ItemCounts = Record<ItemKind, number>;

export function isItemKind(value: string): value is ItemKind {
  return (ITEM_KINDS as readonly string[]).includes(value);
}

export function noItems(): ItemCounts {
  return { branch: 0, stone: 0, log: 0, iron: 0 };
}

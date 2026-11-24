import type {
  ActionDTO,
  FailReasonDTO,
  ItemDTO,
  UpgradeDTO,
} from '../application/dto.js';

// Nomes em português do que aparece em inglês nos scripts

export const ITEM_NAMES: Record<ItemDTO, { one: string; many: string }> = {
  branch: { one: 'galho', many: 'galhos' },
  stone: { one: 'pedra', many: 'pedras' },
  log: { one: 'tronco', many: 'troncos' },
  iron: { one: 'ferro', many: 'ferros' },
};

export const UPGRADE_NAMES: Record<UpgradeDTO, string> = {
  pickaxe: 'picareta',
  battery: 'bateria',
  cargo: 'compartimento',
  vision: 'visão',
  warehouse: 'armazém',
};

// Como o operador escreve a melhoria na CLI (com ou sem acento, ou em inglês)
export const UPGRADE_ALIASES: Readonly<Record<string, UpgradeDTO>> = {
  picareta: 'pickaxe',
  bateria: 'battery',
  compartimento: 'cargo',
  visao: 'vision',
  visão: 'vision',
  armazem: 'warehouse',
  armazém: 'warehouse',
  pickaxe: 'pickaxe',
  battery: 'battery',
  cargo: 'cargo',
  vision: 'vision',
  warehouse: 'warehouse',
};

export const ACTION_NAMES: Record<ActionDTO, string> = {
  forward: 'andar para a frente',
  backward: 'andar para trás',
  stepRight: 'andar para a direita',
  stepLeft: 'andar para a esquerda',
  turnRight: 'girar',
  turnLeft: 'girar',
  wait: 'esperar',
  shareMap: 'compartilhar o mapa',
  forgetMap: 'apagar o mapa',
  recharge: 'recarregar',
  collect: 'pegar o item',
  unload: 'descarregar',
  mine: 'minerar',
  upgrade: 'fazer a melhoria',
};

export function failText(action: ActionDTO, reason: FailReasonDTO): string {
  switch (reason) {
    case 'noBattery':
      return 'falta bateria';
    case 'notAtBase':
      return 'precisa estar na base';
    case 'nothing':
      return action === 'mine' ? 'não há jazida na frente' : 'não há item aqui';
    case 'full':
      return action === 'unload'
        ? 'o armazém está cheio'
        : 'não cabe no compartimento';
    case 'empty':
      return 'o compartimento está vazio';
    case 'noTool':
      return 'precisa da picareta';
    case 'maxLevel':
      return 'já está no nível máximo';
    case 'missing':
      return 'faltam itens no armazém';
  }
}

// "2 galhos, 1 pedra" (só os que têm quantidade)
export function itemList(counts: Record<ItemDTO, number>): string {
  const parts = (Object.keys(ITEM_NAMES) as ItemDTO[])
    .filter((item) => counts[item] > 0)
    .map((item) => {
      const count = counts[item];
      const { one, many } = ITEM_NAMES[item];
      return `${String(count)} ${count === 1 ? one : many}`;
    });
  return parts.length === 0 ? 'nada' : parts.join(', ');
}

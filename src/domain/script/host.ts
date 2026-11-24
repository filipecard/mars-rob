import type { ItemCounts, ItemKind } from '../world/Item.js';
import type { UpgradeKind, UpgradeLevels } from '../world/Upgrade.js';

// O que o script pode pedir ao mundo. O interpretador não conhece a malha nem a frota:
// quem executa o script (a simulação) implementa RobotHost e aplica as ações.

// Ações: cada uma gasta 1 tick. O resultado (true/false) volta para o script.
export type Action =
  | {
      kind:
        | 'forward'
        | 'backward'
        | 'stepRight'
        | 'stepLeft'
        | 'turnRight'
        | 'turnLeft'
        | 'wait'
        // RN24: carrega na base
        | 'recharge'
        // RN25: pega o item da casa / descarrega no armazém
        | 'collect'
        | 'unload'
        // RN27: minera a jazida da frente
        | 'mine';
    }
  // RN28
  | { kind: 'upgrade'; upgrade: UpgradeKind }
  | { kind: 'shareMap'; to: number }
  // RN20: apaga o mapa do próprio robô
  | { kind: 'forgetMap' };

// Os passos que não giram o robô (goTo anda só com eles)
export type StepKind = 'forward' | 'backward' | 'stepRight' | 'stepLeft';

export type CellType = 'empty' | 'obstacle' | 'robot' | 'edge' | 'unknown';

export interface CellInfo {
  type: CellType;
  x: number;
  y: number;
  // ID do robô na casa, se houver
  robot: number | null;
  // RN19: o robô já esteve nesta casa
  visited: boolean;
  // RN19: quantas casas desconhecidas há na visão desta casa (o que o robô descobriria parando nela)
  unknownAround: number;
  // RN25: o item no chão, se houver
  item: ItemKind | null;
  // O que bloqueia a casa: rocha, árvore ou jazida (null se não bloqueia)
  obstacle: 'rock' | 'tree' | 'ore' | null;
  // RN23
  isBase: boolean;
}

// RN24, RN25, RN28: o estado do próprio robô
export interface StatusInfo {
  battery: number;
  maxBattery: number;
  cargo: number;
  maxCargo: number;
  inventory: ItemKind[];
  levels: UpgradeLevels;
}

// RN25: o armazém da base
export interface StorageInfo {
  items: ItemCounts;
  used: number;
  capacity: number;
}

export type Heading = 'north' | 'east' | 'south' | 'west';

export interface SelfInfo {
  id: number;
  x: number;
  y: number;
  orientation: Heading;
}

export type Side = 'front' | 'back' | 'left' | 'right';

// Sensores: não gastam tick
export interface RobotHost {
  self(): SelfInfo;
  // Casa vizinha, relativa à orientação do robô
  look(side: Side): CellInfo;
  // Casas da visão atual (3x3 em volta do robô)
  see(): CellInfo[];
  // Casa do mapa do próprio robô ("unknown" se ele ainda não viu)
  cellAt(x: number, y: number): CellInfo;
  // Quantas casas o robô conhece
  explored(): number;
  // RN21: o menor caminho até (x, y) só por casas conhecidas, em passos sem giro.
  // [] se ele já está lá; null se não há caminho conhecido.
  pathTo(x: number, y: number): StepKind[] | null;
  // RN22: a casa conhecida mais próxima de onde se vê algo desconhecido (null se não há)
  nearestUnknown(): CellInfo | null;
  // O menor caminho até uma casa ao lado de (x, y), só por casas conhecidas
  pathNextTo(x: number, y: number): StepKind[] | null;
  // RN25: a casa conhecida mais próxima com um item (do tipo pedido, se houver)
  nearestItem(kind: ItemKind | null): CellInfo | null;
  // RN27: a jazida conhecida mais próxima que dá para alcançar
  nearestOre(): CellInfo | null;
  status(): StatusInfo;
  // RN23
  base(): { x: number; y: number };
  warehouse(): StorageInfo;
  // RN28
  canUpgrade(kind: UpgradeKind): boolean;
  print(text: string): void;
}

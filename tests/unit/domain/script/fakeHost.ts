import type {
  Action,
  CellInfo,
  RobotHost,
  SelfInfo,
  Side,
  StatusInfo,
  StepKind,
  StorageInfo,
} from '../../../../src/domain/script/host.js';
import type { ItemKind } from '../../../../src/domain/world/Item.js';
import type { UpgradeKind } from '../../../../src/domain/world/Upgrade.js';
import {
  ScriptProcess,
  type ProcessStep,
} from '../../../../src/domain/script/interpreter.js';

// Robô de mentira para testar a linguagem sem malha nem frota
export class FakeHost implements RobotHost {
  readonly printed: string[] = [];
  state: SelfInfo = { id: 1, x: 0, y: 0, orientation: 'north' };
  cells: Partial<Record<Side, CellInfo>> = {};
  visible: CellInfo[] = [];
  known = 9;
  path: StepKind[] | null = [];
  pathRequests: [number, number][] = [];
  frontier: CellInfo | null = null;
  nextToPath: StepKind[] | null = [];
  itemFound: CellInfo | null = null;
  itemRequests: (ItemKind | null)[] = [];
  oreFound: CellInfo | null = null;
  statusInfo: StatusInfo = {
    battery: 80,
    maxBattery: 100,
    cargo: 3,
    maxCargo: 10,
    inventory: ['branch', 'stone'],
    levels: { pickaxe: 1, axe: 0, battery: 0, cargo: 0, vision: 0, warehouse: 2 },
  };
  storage: StorageInfo = {
    items: { branch: 2, stone: 0, log: 1, hardwood: 0, ancientWood: 0, copper: 0, iron: 0, gold: 0, diamond: 0 },
    used: 6,
    capacity: 50,
  };
  upgradable = new Set<UpgradeKind>(['battery']);

  self(): SelfInfo {
    return { ...this.state };
  }

  look(side: Side): CellInfo {
    return (
      this.cells[side] ?? {
        type: 'empty',
        x: 0,
        y: 1,
        robot: null,
        visited: false,
        unknownAround: 0,
        item: null,
        obstacle: null,
        isBase: false,
      }
    );
  }

  see(): CellInfo[] {
    return this.visible;
  }

  cellAt(x: number, y: number): CellInfo {
    return {
      type: 'unknown',
      x,
      y,
      robot: null,
      visited: false,
      unknownAround: 0,
      item: null,
      obstacle: null,
      isBase: false,
    };
  }

  explored(): number {
    return this.known;
  }

  pathTo(x: number, y: number): StepKind[] | null {
    this.pathRequests.push([x, y]);
    return this.path;
  }

  nearestUnknown(): CellInfo | null {
    return this.frontier;
  }

  pathNextTo(x: number, y: number): StepKind[] | null {
    this.pathRequests.push([x, y]);
    return this.nextToPath;
  }

  nearestItem(kind: ItemKind | null): CellInfo | null {
    this.itemRequests.push(kind);
    return this.itemFound;
  }

  nearestOre(): CellInfo | null {
    return this.oreFound;
  }

  status(): StatusInfo {
    return this.statusInfo;
  }

  base(): { x: number; y: number } {
    return { x: 0, y: 0 };
  }

  warehouse(): StorageInfo {
    return this.storage;
  }

  canUpgrade(kind: UpgradeKind): boolean {
    return this.upgradable.has(kind);
  }

  print(text: string): void {
    this.printed.push(text);
  }
}

export interface RunResult {
  actions: Action[];
  last: ProcessStep;
  host: FakeHost;
}

// Roda até terminar (ou até `maxSteps` ações), respondendo a cada ação com `answer`
export function runScript(
  source: string,
  {
    host = new FakeHost(),
    answer = () => true,
    maxSteps = 100,
  }: {
    host?: FakeHost;
    answer?: (action: Action, index: number) => boolean;
    maxSteps?: number;
  } = {},
): RunResult {
  const process = ScriptProcess.compile(source, host);
  const actions: Action[] = [];
  let result = true;
  for (;;) {
    const step = process.next(result);
    if (step.kind !== 'action' || actions.length >= maxSteps) {
      return { actions, last: step, host };
    }
    actions.push(step.action);
    result = answer(step.action, actions.length - 1);
  }
}

export const kinds = (actions: Action[]): string[] =>
  actions.map((action) => action.kind);

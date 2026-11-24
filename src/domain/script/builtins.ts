import { isItemKind, ITEM_KINDS, type ItemKind } from '../world/Item.js';
import {
  isUpgradeKind,
  UPGRADE_KINDS,
  type UpgradeKind,
} from '../world/Upgrade.js';
import type {
  Action,
  CellInfo,
  Heading,
  RobotHost,
  SelfInfo,
  Side,
  StepKind,
  StorageInfo,
} from './host.js';
import { ScriptRuntimeError, type SourceLocation } from './ScriptError.js';
import {
  record,
  Scope,
  toText,
  typeName,
  type Execution,
  type NativeValue,
  type RecordValue,
  type Value,
} from './values.js';

// stop() não é um erro: só encerra o programa
export class StopSignal extends Error {
  constructor() {
    super('stop()');
  }
}

export const BUILTIN_NAMES = [
  'forward',
  'backward',
  'stepRight',
  'stepLeft',
  'turnRight',
  'turnLeft',
  'wait',
  'shareMap',
  'forgetMap',
  'goTo',
  'goNextTo',
  'face',
  'recharge',
  'collect',
  'unload',
  'mine',
  'upgrade',
  'stop',
  'front',
  'back',
  'left',
  'right',
  'see',
  'cellAt',
  'explored',
  'nearestUnknown',
  'nearestItem',
  'nearestOre',
  'battery',
  'maxBattery',
  'cargo',
  'maxCargo',
  'inventory',
  'base',
  'warehouse',
  'canUpgrade',
  'level',
  'type',
  'print',
  'abs',
  'min',
  'max',
  'floor',
] as const;

export function positionRecord(x: number, y: number): RecordValue {
  return record('position', { x, y });
}

export function cellRecord(cell: CellInfo): RecordValue {
  return record('cell', {
    type: cell.type,
    isEmpty: cell.type === 'empty',
    isUnknown: cell.type === 'unknown',
    visited: cell.visited,
    unknownAround: cell.unknownAround,
    position: positionRecord(cell.x, cell.y),
    robot: cell.robot,
    item: cell.item,
    obstacle: cell.obstacle,
    isBase: cell.isBase,
  });
}

export function storageRecord(storage: StorageInfo): RecordValue {
  return record('storage', {
    ...storage.items,
    used: storage.used,
    capacity: storage.capacity,
  });
}

export function selfRecord(self: SelfInfo): RecordValue {
  return record('robot', {
    id: self.id,
    position: positionRecord(self.x, self.y),
    orientation: self.orientation,
  });
}

// Escopo raiz, travado, com as funções da linguagem
export function builtinScope(host: RobotHost): Scope {
  const scope = new Scope(null, true);
  const define = (
    name: (typeof BUILTIN_NAMES)[number],
    minArgs: number,
    maxArgs: number,
    call: NativeValue['call'],
  ): void => {
    scope.declare(name, { kind: 'native', name, minArgs, maxArgs, call });
  };

  // Ações: gastam 1 tick; o resultado (deu certo ou não) volta do yield
  const action = (name: (typeof BUILTIN_NAMES)[number], act: Action): void => {
    define(name, 0, 0, function* (): Execution {
      return yield act;
    });
  };
  action('forward', { kind: 'forward' });
  action('backward', { kind: 'backward' });
  action('stepRight', { kind: 'stepRight' });
  action('stepLeft', { kind: 'stepLeft' });
  action('turnRight', { kind: 'turnRight' });
  action('turnLeft', { kind: 'turnLeft' });
  action('wait', { kind: 'wait' });
  action('forgetMap', { kind: 'forgetMap' });
  define('shareMap', 1, 1, function* ([to], location): Execution {
    return yield { kind: 'shareMap', to: integer(to ?? null, location) };
  });
  // RN21: um passo por tick pelo menor caminho; para no primeiro passo que falhar
  define('goTo', 2, 2, function* ([x, y], location): Execution {
    return yield* walk(
      host.pathTo(integer(x ?? null, location), integer(y ?? null, location)),
    );
  });
  // Vai até uma casa ao lado de (x, y): para minerar ou pegar algo que bloqueia
  define('goNextTo', 2, 2, function* ([x, y], location): Execution {
    return yield* walk(
      host.pathNextTo(
        integer(x ?? null, location),
        integer(y ?? null, location),
      ),
    );
  });
  // Gira (1 tick por giro) até olhar para a casa (x, y), que precisa estar ao lado
  define('face', 2, 2, function* ([x, y], location): Execution {
    const me = host.self();
    const dx = integer(x ?? null, location) - me.x;
    const dy = integer(y ?? null, location) - me.y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) {
      return false;
    }
    const target: Heading =
      dx === 1 ? 'east' : dx === -1 ? 'west' : dy === 1 ? 'north' : 'south';
    const turns =
      (HEADINGS.indexOf(target) - HEADINGS.indexOf(me.orientation) + 4) % 4;
    if (turns === 3) {
      return yield { kind: 'turnLeft' };
    }
    for (let i = 0; i < turns; i++) {
      if (!(yield { kind: 'turnRight' })) {
        return false;
      }
    }
    return true;
  });
  action('recharge', { kind: 'recharge' });
  action('collect', { kind: 'collect' });
  action('unload', { kind: 'unload' });
  action('mine', { kind: 'mine' });
  define('upgrade', 1, 1, function* ([kind], location): Execution {
    return yield {
      kind: 'upgrade',
      upgrade: upgradeKind(kind ?? null, location),
    };
  });
  // eslint-disable-next-line require-yield -- encerra sem pedir ação
  define('stop', 0, 0, function* (): Execution {
    throw new StopSignal();
  });

  // Sensores: não gastam tick
  const sensor = (name: (typeof BUILTIN_NAMES)[number], side: Side): void => {
    define(
      name,
      0,
      0,
      pure(() => cellRecord(host.look(side))),
    );
  };
  sensor('front', 'front');
  sensor('back', 'back');
  sensor('left', 'left');
  sensor('right', 'right');
  define(
    'see',
    0,
    0,
    pure(() => ({ kind: 'list', items: host.see().map(cellRecord) })),
  );
  define(
    'cellAt',
    2,
    2,
    pure(([x, y], location) =>
      cellRecord(
        host.cellAt(integer(x ?? null, location), integer(y ?? null, location)),
      ),
    ),
  );
  define(
    'explored',
    0,
    0,
    pure(() => host.explored()),
  );

  define(
    'nearestUnknown',
    0,
    0,
    pure(() => {
      const cell = host.nearestUnknown();
      return cell === null ? null : cellRecord(cell);
    }),
  );

  define(
    'nearestItem',
    0,
    1,
    pure(([kind], location) => {
      const cell = host.nearestItem(
        kind === undefined || kind === null ? null : itemKind(kind, location),
      );
      return cell === null ? null : cellRecord(cell);
    }),
  );
  define(
    'nearestOre',
    0,
    0,
    pure(() => {
      const cell = host.nearestOre();
      return cell === null ? null : cellRecord(cell);
    }),
  );
  const status = (
    name: (typeof BUILTIN_NAMES)[number],
    read: () => Value,
  ): void => {
    define(name, 0, 0, pure(read));
  };
  status('battery', () => host.status().battery);
  status('maxBattery', () => host.status().maxBattery);
  status('cargo', () => host.status().cargo);
  status('maxCargo', () => host.status().maxCargo);
  status('inventory', () => ({
    kind: 'list',
    items: host.status().inventory,
  }));
  status('base', () => {
    const { x, y } = host.base();
    return positionRecord(x, y);
  });
  status('warehouse', () => storageRecord(host.warehouse()));
  define(
    'canUpgrade',
    1,
    1,
    pure(([kind], location) =>
      host.canUpgrade(upgradeKind(kind ?? null, location)),
    ),
  );
  define(
    'level',
    1,
    1,
    pure(
      ([kind], location) =>
        host.status().levels[upgradeKind(kind ?? null, location)],
    ),
  );

  // type(casa) devolve o que há nela; para os outros valores, o nome do tipo
  define(
    'type',
    1,
    1,
    pure(([value]) => {
      const target = value ?? null;
      if (
        target !== null &&
        typeof target === 'object' &&
        target.kind === 'record' &&
        target.type === 'cell'
      ) {
        return target.fields.get('type') ?? null;
      }
      return typeName(target);
    }),
  );
  define(
    'print',
    0,
    Infinity,
    pure((args) => {
      host.print(args.map(toText).join(' '));
      return null;
    }),
  );
  define(
    'abs',
    1,
    1,
    pure(([n], location) => Math.abs(number(n ?? null, location))),
  );
  define(
    'floor',
    1,
    1,
    pure(([n], location) => Math.floor(number(n ?? null, location))),
  );
  define(
    'min',
    1,
    Infinity,
    pure((args, location) =>
      Math.min(...args.map((arg) => number(arg, location))),
    ),
  );
  define(
    'max',
    1,
    Infinity,
    pure((args, location) =>
      Math.max(...args.map((arg) => number(arg, location))),
    ),
  );
  return scope;
}

const HEADINGS: readonly Heading[] = ['north', 'east', 'south', 'west'];

// Anda o caminho um passo por tick; para no primeiro passo que falhar
function* walk(path: StepKind[] | null): Execution {
  if (path === null) {
    return false;
  }
  for (const kind of path) {
    const moved = yield { kind };
    if (!moved) {
      return false;
    }
  }
  return true;
}

function upgradeKind(value: Value, location: SourceLocation): UpgradeKind {
  if (typeof value === 'string' && isUpgradeKind(value)) {
    return value;
  }
  throw new ScriptRuntimeError(
    `melhoria desconhecida ${toText(value)}: use ${UPGRADE_KINDS.map((k) => `"${k}"`).join(', ')}`,
    location,
  );
}

function itemKind(value: Value, location: SourceLocation): ItemKind {
  if (typeof value === 'string' && isItemKind(value)) {
    return value;
  }
  throw new ScriptRuntimeError(
    `item desconhecido ${toText(value)}: use ${ITEM_KINDS.map((k) => `"${k}"`).join(', ')}`,
    location,
  );
}

// Função nativa que não pede ação: termina sem yield
function pure(
  compute: (args: Value[], location: SourceLocation) => Value,
): NativeValue['call'] {
  // eslint-disable-next-line require-yield -- funções sem ação não pausam
  return function* (args, location): Execution {
    return compute(args, location);
  };
}

export function number(value: Value, location: SourceLocation): number {
  if (typeof value !== 'number') {
    throw new ScriptRuntimeError(
      `esperava um número, recebeu ${typeName(value)}`,
      location,
    );
  }
  return value;
}

export function integer(value: Value, location: SourceLocation): number {
  const n = number(value, location);
  if (!Number.isInteger(n)) {
    throw new ScriptRuntimeError(
      `esperava um número inteiro, recebeu ${String(n)}`,
      location,
    );
  }
  return n;
}

import { describe, expect, it } from 'vitest';
import type {
  EventDTO,
  RobotStatusDTO,
  StorageDTO,
} from '../../../src/application/dto.js';
import type {
  LoadResult,
  SaveResult,
} from '../../../src/application/use-cases/SaveGame.js';
import type { UpgradeResult } from '../../../src/application/use-cases/UpgradeRobot.js';
import type { LoadScriptResult } from '../../../src/application/use-cases/LoadScript.js';
import type { OrderResult } from '../../../src/application/use-cases/ExecuteOrders.js';
import { failText, itemList } from '../../../src/presentation/names.js';
import {
  formatEvent,
  formatForgotten,
  formatLoadResult,
  formatLoadScriptResult,
  formatOrderResult,
  formatPosition,
  formatRobotState,
  formatSaveResult,
  formatStatus,
  formatUpgradeResult,
  unknownRobot,
} from '../../../src/presentation/cli/formatResult.js';

const event = (body: object): EventDTO =>
  ({ tick: 1, robot: 2, ...body }) as EventDTO;
const storage: StorageDTO = {
  used: 0,
  capacity: 50,
  items: { branch: 0, stone: 0, log: 0, hardwood: 0, ancientWood: 0, copper: 0, iron: 0, gold: 0, diamond: 0 },
};
const robot = {
  id: 2,
  atBase: true,
  battery: 5,
  maxBattery: 100,
  cargo: { ...storage, used: 3, items: { ...storage.items, iron: 1 } },
  map: { robot: { id: 2, x: 1, y: -2, orientation: 'N' } },
  upgrades: [{ upgrade: 'pickaxe', level: 1 }],
} as RobotStatusDTO;

describe('formatResult e nomes em português', () => {
  it('formata posições, robôs, itens e falhas', () => {
    expect(formatPosition({ x: 2, y: -3 })).toBe('(X: 2, Y: -3)');
    expect(formatRobotState(robot.map.robot)).toContain('Norte');
    expect(unknownRobot(8)).toContain('8');
    expect(itemList(storage.items)).toBe('nada');
    expect(itemList({ branch: 1, stone: 2, log: 0, hardwood: 0, ancientWood: 0, copper: 0, iron: 1, gold: 0, diamond: 0 })).toBe(
      '1 galho, 2 pedras, 1 ferro',
    );
    expect(failText('mine', 'nothing')).toContain('jazida');
    expect(failText('collect', 'nothing')).toContain('item');
    expect(failText('unload', 'full')).toContain('armazém');
    expect(failText('collect', 'full')).toContain('compartimento');
    for (const reason of [
      'noBattery',
      'notAtBase',
      'empty',
      'noTool',
      'maxLevel',
      'missing',
    ] as const) {
      expect(failText('upgrade', reason)).not.toBe('');
    }
  });

  it('formata resultados de ordens', () => {
    const ok: OrderResult = { ok: true, input: '1:N', robotId: 1 };
    expect(formatOrderResult(ok)).toBeNull();
    expect(
      formatOrderResult({
        ok: false,
        error: 'UNKNOWN_ROBOT',
        input: '4:N',
        robotId: 4,
      }),
    ).toContain('4');
    expect(
      formatOrderResult({ ok: false, error: 'INVALID_COMMAND', input: '1:X' }),
    ).toContain('Comando');
    expect(
      formatOrderResult({ ok: false, error: 'INVALID_ORDER', input: '?' }),
    ).toContain('Ordem');
  });

  it('formata todos os eventos do mundo', () => {
    for (const body of [
      { kind: 'moved', position: { x: 0, y: 1 }, orientation: 'N' },
      { kind: 'turned', position: { x: 0, y: 1 }, orientation: 'N' },
      { kind: 'waited' },
      { kind: 'recharged', added: 2, battery: 3 },
      { kind: 'finished' },
    ])
      expect(formatEvent(event(body))).toBeNull();
    expect(formatEvent(event({ kind: 'collected', item: 'stone' }))).toContain(
      'uma pedra',
    );
    expect(formatEvent(event({ kind: 'collected', item: 'iron' }))).toContain(
      'um ferro',
    );
    expect(formatEvent(event({ kind: 'unloaded', count: 1 }))).toContain(
      '1 item',
    );
    expect(formatEvent(event({ kind: 'unloaded', count: 2 }))).toContain(
      '2 itens',
    );
    expect(
      formatEvent(
        event({
          kind: 'mined',
          item: 'iron',
          at: { x: 1, y: 2 },
          depleted: true,
        }),
      ),
    ).toContain('jazida acabou');
    expect(
      formatEvent(
        event({
          kind: 'mined',
          item: 'iron',
          at: { x: 1, y: 2 },
          depleted: false,
        }),
      ),
    ).not.toContain('jazida acabou');
    expect(
      formatEvent(event({ kind: 'upgraded', upgrade: 'battery', level: 1 })),
    ).toContain('bateria');
    expect(
      formatEvent(event({ kind: 'failed', action: 'collect', reason: 'full' })),
    ).toContain('compartimento');
    for (const reason of ['edge', 'obstacle', 'robot'] as const) {
      expect(
        formatEvent(
          event({ kind: 'blocked', reason, at: { x: 0, y: 1 }, other: 3 }),
        ),
      ).not.toBeNull();
    }
    for (const reason of ['notAdjacent', 'unknownRobot', 'self'] as const) {
      expect(
        formatEvent(event({ kind: 'shareFailed', to: 3, reason })),
      ).not.toBeNull();
    }
    expect(formatEvent(event({ kind: 'shared', to: 3, added: 0 }))).toContain(
      'nenhuma casa',
    );
    expect(formatEvent(event({ kind: 'shared', to: 3, added: 1 }))).toContain(
      '1 casa',
    );
    expect(formatEvent(event({ kind: 'shared', to: 3, added: 2 }))).toContain(
      '2 casas',
    );
    expect(formatEvent(event({ kind: 'forgot', forgotten: 0 }))).toContain(
      'nenhuma casa',
    );
    expect(formatEvent(event({ kind: 'forgot', forgotten: 1 }))).toContain(
      '1 casa',
    );
    expect(formatEvent(event({ kind: 'forgot', forgotten: 2 }))).toContain(
      '2 casas',
    );
    expect(formatEvent(event({ kind: 'printed', text: 'oi' }))).toContain('oi');
    expect(
      formatEvent(event({ kind: 'error', line: 1, column: 2, message: 'x' })),
    ).toContain('linha 1');
  });

  it('formata status, melhorias e saves', () => {
    expect(formatForgotten(0)).toContain('nenhuma');
    expect(formatForgotten(1)).toContain('1 casa');
    expect(formatForgotten(3)).toContain('3 casas');
    expect(formatStatus(robot, storage)).toContain('picareta 1');
    expect(
      formatStatus({ ...robot, atBase: false, upgrades: [] }, storage),
    ).toContain('Melhorias: nenhuma');
    const upgraded: UpgradeResult = { ok: true, upgrade: 'battery', level: 2 };
    expect(formatUpgradeResult(upgraded)).toContain('nível 2');
    expect(
      formatUpgradeResult({ ok: false, error: 'UNKNOWN_ROBOT', robotId: 7 }),
    ).toContain('7');
    expect(
      formatUpgradeResult({
        ok: false,
        error: 'UNKNOWN_UPGRADE',
        upgrade: 'laser',
      }),
    ).toContain('desconhecida');
    expect(
      formatUpgradeResult({
        ok: false,
        error: 'UPGRADE_FAILED',
        upgrade: 'battery',
        reason: 'missing',
        missing: { branch: 0, stone: 0, log: 1, hardwood: 0, ancientWood: 0, copper: 0, iron: 0, gold: 0, diamond: 0 },
      }),
    ).toContain('faltam 1 tronco');
    expect(
      formatUpgradeResult({
        ok: false,
        error: 'UPGRADE_FAILED',
        upgrade: 'battery',
        reason: 'notAtBase',
        missing: null,
      }),
    ).toContain('base');
    expect(
      formatSaveResult({
        ok: true,
        name: 'mars',
        tick: 4,
      } satisfies SaveResult),
    ).toContain('tick 4');
    expect(
      formatSaveResult({ ok: false, error: 'INVALID_NAME', name: 'x?' }),
    ).toContain('inválido');
    const loadResults: LoadResult[] = [
      { ok: true, name: 'mars', tick: 4 },
      { ok: false, error: 'INVALID_NAME', name: 'x?' },
      { ok: false, error: 'NOT_FOUND', name: 'mars' },
      { ok: false, error: 'INVALID_SAVE', name: 'mars' },
    ];
    for (const result of loadResults)
      expect(formatLoadResult(result)).not.toBe('');
    const loaded: LoadScriptResult = { ok: true };
    const missingRobot: LoadScriptResult = {
      ok: false,
      error: 'UNKNOWN_ROBOT',
      robotId: 9,
    };
    const syntaxError: LoadScriptResult = {
      ok: false,
      error: 'SYNTAX',
      message: 'erro',
      line: 2,
      column: 1,
    };
    expect(formatLoadScriptResult(loaded)).toBeNull();
    expect(formatLoadScriptResult(missingRobot)).toContain('9');
    expect(formatLoadScriptResult(syntaxError)).toContain('linha 2');
  });
});

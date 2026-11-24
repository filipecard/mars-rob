import { describe, expect, it } from 'vitest';
import { Inventory } from '../../../../src/domain/world/Inventory.js';
import { isItemKind } from '../../../../src/domain/world/Item.js';
import {
  isUpgradeKind,
  upgradeCost,
} from '../../../../src/domain/world/Upgrade.js';

describe('Inventory — RN25', () => {
  it('cada item ocupa o próprio espaço: galho 1, pedra 2, tronco 4, ferro 3', () => {
    const inventory = new Inventory(10);

    expect(inventory.add('branch')).toBe(true);
    expect(inventory.add('stone')).toBe(true);
    expect(inventory.add('log')).toBe(true);
    expect(inventory.used).toBe(7);
    // ferro (3) ainda cabe; outro tronco (4) não
    expect(inventory.fits('iron')).toBe(true);
    expect(inventory.add('log')).toBe(false);
    expect(inventory.list()).toEqual(['branch', 'stone', 'log']);
  });

  it('cresce, confere, tira e diz o que falta', () => {
    const inventory = new Inventory(4, { branch: 2 });
    inventory.grow(6);

    expect(inventory.capacity).toBe(10);
    expect(inventory.has({ branch: 2 })).toBe(true);
    expect(inventory.has({ branch: 3 })).toBe(false);
    expect(inventory.missing({ branch: 3, stone: 1 })).toEqual({
      branch: 1,
      stone: 1,
      log: 0,
      iron: 0,
    });
    expect(inventory.take({ branch: 3 })).toBe(false);
    expect(inventory.take({ branch: 2 })).toBe(true);
    expect(inventory.isEmpty).toBe(true);
  });

  it('transfere o que couber, dos itens maiores para os menores', () => {
    const cargo = new Inventory(20, { branch: 2, log: 2 });
    const warehouse = new Inventory(9);

    // cabem 2 troncos (8) e 1 galho (1)
    expect(cargo.transferTo(warehouse)).toBe(3);
    expect(warehouse.counts()).toEqual({
      branch: 1,
      stone: 0,
      log: 2,
      iron: 0,
    });
    expect(cargo.counts()).toEqual({ branch: 1, stone: 0, log: 0, iron: 0 });
  });

  it('recusa capacidade inválida e itens que não cabem', () => {
    expect(() => new Inventory(-1)).toThrow(RangeError);
    expect(() => new Inventory(1.5)).toThrow(RangeError);
    expect(() => new Inventory(3, { log: 1 })).toThrow(RangeError);
  });

  it('reconhece os nomes dos itens e das melhorias', () => {
    expect(isItemKind('log')).toBe(true);
    expect(isItemKind('wood')).toBe(false);
    expect(isUpgradeKind('pickaxe')).toBe(true);
    expect(isUpgradeKind('laser')).toBe(false);
  });

  it('o nível n custa n vezes o custo do nível 1 — RN28', () => {
    expect(upgradeCost('battery', 2)).toEqual({
      branch: 0,
      stone: 0,
      log: 4,
      iron: 8,
    });
  });
});

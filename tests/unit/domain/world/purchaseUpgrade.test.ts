import { describe, expect, it } from 'vitest';
import { Fleet } from '../../../../src/domain/entities/Fleet.js';
import { Grid } from '../../../../src/domain/value-objects/Grid.js';
import { Position } from '../../../../src/domain/value-objects/Position.js';
import { World } from '../../../../src/domain/world/World.js';
import {
  checkUpgrade,
  purchaseUpgrade,
  upgradeLevels,
} from '../../../../src/domain/world/purchaseUpgrade.js';

describe('purchaseUpgrade — RN28', () => {
  it('checa localização, itens, níveis e compra melhorias do robô e da base', () => {
    const world = World.create(Grid.square(3));
    const atBase = Fleet.create(world, 1, () => 0.5).robot(1);
    const away = Fleet.place(Grid.square(3), [
      { position: Position.create(1, 0) },
    ]).robot(1);

    expect(checkUpgrade(world, away, 'pickaxe')).toMatchObject({
      ok: false,
      reason: 'notAtBase',
      missing: null,
    });
    expect(checkUpgrade(world, atBase, 'pickaxe')).toMatchObject({
      ok: false,
      reason: 'missing',
    });
    world.warehouse.add('branch');
    world.warehouse.add('branch');
    world.warehouse.add('branch');
    world.warehouse.add('stone');
    world.warehouse.add('stone');
    expect(purchaseUpgrade(world, atBase, 'pickaxe')).toMatchObject({
      ok: true,
      level: 1,
    });
    expect(checkUpgrade(world, atBase, 'pickaxe')).toMatchObject({
      ok: false,
      reason: 'maxLevel',
    });

    for (let i = 0; i < 6; i++) world.warehouse.add('log');
    for (let i = 0; i < 4; i++) world.warehouse.add('stone');
    const capacity = world.warehouse.capacity;
    expect(purchaseUpgrade(world, atBase, 'warehouse')).toMatchObject({
      ok: true,
      level: 1,
    });
    expect(world.warehouse.capacity).toBe(capacity + 50);
    expect(upgradeLevels(world, atBase).warehouse).toBe(1);

    for (let i = 0; i < 4; i++) world.warehouse.add('iron');
    for (let i = 0; i < 2; i++) world.warehouse.add('log');
    expect(purchaseUpgrade(world, atBase, 'battery')).toMatchObject({
      ok: true,
      level: 1,
    });
    expect(atBase.maxBattery).toBe(150);
  });
});

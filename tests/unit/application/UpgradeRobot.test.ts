import { describe, expect, it } from 'vitest';
import { UpgradeRobot } from '../../../src/application/use-cases/UpgradeRobot.js';
import { Fleet } from '../../../src/domain/entities/Fleet.js';
import { Simulation } from '../../../src/domain/simulation/Simulation.js';
import { Grid } from '../../../src/domain/value-objects/Grid.js';
import { World } from '../../../src/domain/world/World.js';
import { InMemorySimulationRepository } from '../../../src/infrastructure/repositories/InMemorySimulationRepository.js';

function setup(): { repository: InMemorySimulationRepository; world: World } {
  const world = World.create(Grid.square(3));
  const fleet = Fleet.create(world, 1, () => 0.5);
  return {
    repository: new InMemorySimulationRepository(new Simulation(fleet)),
    world,
  };
}

describe('UpgradeRobot', () => {
  it('recusa melhoria desconhecida e robô inexistente', async () => {
    const { repository } = setup();
    const useCase = new UpgradeRobot(repository);
    expect(await useCase.execute(1, 'laser')).toMatchObject({
      error: 'UNKNOWN_UPGRADE',
    });
    expect(await useCase.execute(2, 'battery')).toMatchObject({
      error: 'UNKNOWN_ROBOT',
    });
  });

  it('informa itens ausentes e aplica melhoria comprada na base', async () => {
    const { repository, world } = setup();
    const useCase = new UpgradeRobot(repository);
    expect(await useCase.execute(1, 'pickaxe')).toMatchObject({
      error: 'UPGRADE_FAILED',
      reason: 'missing',
      missing: { branch: 3, stone: 2 },
    });
    for (let i = 0; i < 3; i++) world.warehouse.add('branch');
    for (let i = 0; i < 2; i++) world.warehouse.add('stone');
    expect(await useCase.execute(1, 'pickaxe')).toEqual({
      ok: true,
      upgrade: 'pickaxe',
      level: 1,
    });
  });
});

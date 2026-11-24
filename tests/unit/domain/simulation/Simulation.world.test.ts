import { describe, expect, it } from 'vitest';
import { Fleet } from '../../../../src/domain/entities/Fleet.js';
import {
  DEFAULT_ROBOT_SETTINGS,
  type RobotSettings,
} from '../../../../src/domain/entities/Robot.js';
import {
  Simulation,
  type SimulationEvent,
} from '../../../../src/domain/simulation/Simulation.js';
import { Grid } from '../../../../src/domain/value-objects/Grid.js';
import { Position } from '../../../../src/domain/value-objects/Position.js';
import {
  STATIC_WORLD_SETTINGS,
  World,
} from '../../../../src/domain/world/World.js';

const at = (x: number, y: number): Position => Position.create(x, y);

function setup(
  options: {
    battery?: number;
    cargo?: number;
    warehouse?: number;
    solarEvery?: number;
    position?: Position;
  } = {},
) {
  const world = World.create(
    Grid.square(4),
    { ...STATIC_WORLD_SETTINGS, warehouse: options.warehouse ?? 50 },
    () => 0.5,
  );
  const settings: RobotSettings = {
    ...DEFAULT_ROBOT_SETTINGS,
    battery: options.battery ?? 20,
    cargo: options.cargo ?? 10,
    solarEvery: options.solarEvery ?? 5,
  };
  const fleet = Fleet.place(
    world,
    [{ position: options.position ?? at(0, 0) }],
    settings,
  );
  return { world, simulation: new Simulation(fleet) };
}

function run(simulation: Simulation, source: string): SimulationEvent[] {
  simulation.loadScript(1, source);
  const events: SimulationEvent[] = [];
  for (let i = 0; i < 50 && !simulation.idle; i++)
    events.push(...simulation.advance());
  return events;
}

describe('Simulation — bateria, coleta, mineração e melhorias', () => {
  it('cobra bateria só por ação bem-sucedida e recupera carga solar parado', () => {
    const { simulation } = setup({ battery: 1, solarEvery: 5 });
    const events = run(
      simulation,
      'forward(); forward(); wait(); wait(); wait(); wait()',
    );
    expect(
      events.some(
        (event) => event.kind === 'failed' && event.reason === 'noBattery',
      ),
    ).toBe(true);
    expect(simulation.fleet.robot(1).battery).toBe(1);
  });

  it('recharge devolve erro fora da base e zero quando já está cheia', () => {
    const away = setup({ position: at(2, 0) });
    expect(
      run(away.simulation, 'recharge()').some(
        (event) => event.kind === 'failed' && event.reason === 'notAtBase',
      ),
    ).toBe(true);
    const home = setup();
    expect(
      run(home.simulation, 'recharge()').some(
        (event) => event.kind === 'recharged' && event.added === 0,
      ),
    ).toBe(true);
  });

  it('coleta, trata casa vazia, compartimento cheio e descarrega parcialmente', () => {
    const { world, simulation } = setup({ cargo: 3, warehouse: 1 });
    world.placeItem(at(0, 0), 'stone');
    const events = run(simulation, 'collect(); collect()');
    expect(
      events.some(
        (event) => event.kind === 'failed' && event.reason === 'nothing',
      ),
    ).toBe(true);
    simulation.fleet.robot(1).cargo.add('branch');
    const unload = run(simulation, 'unload()');
    expect(
      unload.some((event) => event.kind === 'unloaded' && event.count === 1),
    ).toBe(true);
    expect(simulation.fleet.robot(1).cargo.count('stone')).toBe(1);
    const tooSmall = setup({ cargo: 1 });
    tooSmall.world.placeItem(at(0, 0), 'stone');
    expect(
      run(tooSmall.simulation, 'collect()').some(
        (event) => event.kind === 'failed' && event.reason === 'full',
      ),
    ).toBe(true);
  });

  it('rejeita coleta vazia e descarga vazia, fora da base e com armazém cheio', () => {
    const home = setup({ warehouse: 0 });
    const emptyEvents = run(home.simulation, 'collect(); unload()');
    expect(
      emptyEvents
        .filter((event) => event.kind === 'failed')
        .map((event) => event.reason),
    ).toEqual(['nothing', 'empty']);
    home.simulation.fleet.robot(1).cargo.add('branch');
    const fullEvents = run(home.simulation, 'unload()');
    expect(
      fullEvents.some(
        (event) => event.kind === 'failed' && event.reason === 'full',
      ),
    ).toBe(true);
    const away = setup({ position: at(2, 0) });
    away.simulation.fleet.robot(1).cargo.add('branch');
    expect(
      run(away.simulation, 'unload()').some(
        (event) => event.kind === 'failed' && event.reason === 'notAtBase',
      ),
    ).toBe(true);
  });

  it('exige picareta, respeita capacidade e minera jazida até esgotar', () => {
    const { world, simulation } = setup({ cargo: 3, position: at(2, 0) });
    world.addOre(at(2, 1), 1);
    expect(
      run(simulation, 'mine()').some(
        (event) => event.kind === 'failed' && event.reason === 'noTool',
      ),
    ).toBe(true);
    simulation.fleet.robot(1).applyUpgrade('pickaxe');
    const mined = run(simulation, 'mine()');
    expect(
      mined.some((event) => event.kind === 'mined' && event.depleted),
    ).toBe(true);
    const full = setup({ cargo: 2, position: at(2, 0) });
    full.world.addOre(at(2, 1), 2);
    full.simulation.fleet.robot(1).applyUpgrade('pickaxe');
    expect(
      run(full.simulation, 'mine()').some(
        (event) => event.kind === 'failed' && event.reason === 'full',
      ),
    ).toBe(true);
    const none = setup();
    none.simulation.fleet.robot(1).applyUpgrade('pickaxe');
    expect(
      run(none.simulation, 'mine()').some(
        (event) => event.kind === 'failed' && event.reason === 'nothing',
      ),
    ).toBe(true);
  });

  it('emite falhas e sucesso para upgrade pelo script', () => {
    const { world, simulation } = setup();
    expect(
      run(simulation, 'upgrade("pickaxe")').some(
        (event) => event.kind === 'failed' && event.reason === 'missing',
      ),
    ).toBe(true);
    for (let i = 0; i < 3; i++) world.warehouse.add('branch');
    for (let i = 0; i < 2; i++) world.warehouse.add('stone');
    expect(
      run(simulation, 'upgrade("pickaxe")').some(
        (event) => event.kind === 'upgraded',
      ),
    ).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { Fleet } from '../../../../src/domain/entities/Fleet.js';
import { FleetRobotHost } from '../../../../src/domain/simulation/FleetRobotHost.js';
import { Command } from '../../../../src/domain/value-objects/Command.js';
import { Grid } from '../../../../src/domain/value-objects/Grid.js';
import { Obstacle } from '../../../../src/domain/value-objects/Obstacle.js';
import { Position } from '../../../../src/domain/value-objects/Position.js';

const at = (x: number, y: number): Position => Position.create(x, y);

// Malha limite 3, obstáculo em (0,1); robô 1 em (0,0) e robô 2 em (1,0)
function setup(): { fleet: Fleet; host: FleetRobotHost; printed: string[] } {
  const fleet = Fleet.place(Grid.square(3, [Obstacle.create([at(0, 1)])]), [
    { position: at(0, 0) },
    { position: at(1, 0) },
  ]);
  const printed: string[] = [];
  return {
    fleet,
    host: new FleetRobotHost(fleet, 1, (text) => printed.push(text)),
    printed,
  };
}

describe('FleetRobotHost — RN18', () => {
  it('self: id, posição e orientação em inglês', () => {
    const { fleet, host } = setup();
    fleet.move(1, Command.parse('D'));

    expect(host.self()).toEqual({ id: 1, x: 0, y: 0, orientation: 'east' });
  });

  it('look: as casas vizinhas, relativas à orientação', () => {
    const { host } = setup();

    expect(host.look('front')).toEqual({
      type: 'obstacle',
      x: 0,
      y: 1,
      robot: null,
    });
    expect(host.look('right')).toEqual({ type: 'robot', x: 1, y: 0, robot: 2 });
    expect(host.look('back')).toMatchObject({ type: 'empty', x: 0, y: -1 });
    expect(host.look('left')).toMatchObject({ type: 'empty', x: -1, y: 0 });
  });

  it('look depois de girar: a frente passa a ser o Leste', () => {
    const { fleet, host } = setup();
    fleet.move(1, Command.parse('D'));

    expect(host.look('front')).toMatchObject({ type: 'robot', robot: 2 });
  });

  it('fora da malha a casa é "edge"', () => {
    const fleet = Fleet.place(Grid.square(1), [{ position: at(1, 1) }]);
    const host = new FleetRobotHost(fleet, 1, () => undefined);

    expect(host.look('front')).toMatchObject({ type: 'edge', x: 1, y: 2 });
  });

  it('see: as 8 casas em volta, de cima para baixo', () => {
    const { host } = setup();

    expect(
      host
        .see()
        .map((cell) => `${cell.type}@${String(cell.x)},${String(cell.y)}`),
    ).toEqual([
      'empty@-1,1',
      'obstacle@0,1',
      'empty@1,1',
      'empty@-1,0',
      'robot@1,0',
      'empty@-1,-1',
      'empty@0,-1',
      'empty@1,-1',
    ]);
  });

  it('cellAt: desconhecida fora do mapa do robô — RN12', () => {
    const { host } = setup();

    expect(host.cellAt(3, 3)).toEqual({
      type: 'unknown',
      x: 3,
      y: 3,
      robot: null,
    });
    expect(host.cellAt(9, 9).type).toBe('edge');
  });

  it('cellAt: casa conhecida fora da visão não mostra robôs', () => {
    const { fleet, host } = setup();
    // O 1 vai para (-2,0): (0,0) continua no mapa, mas fora da visão
    fleet.move(1, Command.parse('OO'));
    fleet.move(2, Command.parse('O'));

    expect(host.cellAt(0, 0).type).toBe('empty');
    expect(host.cellAt(0, 1).type).toBe('obstacle');
  });

  it('explored e print', () => {
    const { host, printed } = setup();
    host.print('oi');

    expect(host.explored()).toBe(9);
    expect(printed).toEqual(['oi']);
  });
});

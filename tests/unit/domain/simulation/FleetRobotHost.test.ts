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
      visited: false,
      // (−1,2), (0,2) e (1,2) ainda não foram vistas
      unknownAround: 3,
      item: null,
      obstacle: 'rock',
      isBase: false,
    });
    expect(host.look('right')).toMatchObject({
      type: 'robot',
      x: 1,
      y: 0,
      robot: 2,
    });
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
      visited: false,
      // canto da malha: só (2,2), (2,3), (3,2) e (3,3) existem, todas desconhecidas
      unknownAround: 4,
      item: null,
      obstacle: null,
      isBase: false,
    });
    expect(host.cellAt(9, 9)).toEqual({
      type: 'edge',
      x: 9,
      y: 9,
      robot: null,
      visited: false,
      unknownAround: 0,
      item: null,
      obstacle: null,
      isBase: false,
    });
  });

  it('visited: só as casas onde o robô esteve, não as que ele só viu — RN19', () => {
    const { fleet, host } = setup();
    fleet.move(1, Command.parse('OS'));

    expect(host.cellAt(0, 0).visited).toBe(true);
    expect(host.cellAt(-1, 0).visited).toBe(true);
    expect(host.cellAt(-1, -1).visited).toBe(true);
    // vista, mas nunca pisada
    expect(host.cellAt(0, -1)).toMatchObject({ type: 'empty', visited: false });
  });

  it('unknownAround: 0 quando o 3x3 da casa já é todo conhecido — RN19', () => {
    const { host } = setup();

    // (0,0) é o centro da visão inicial: tudo em volta já foi visto
    expect(host.cellAt(0, 0).unknownAround).toBe(0);
    // (1,1): a coluna x = 2 e a linha y = 2 ainda são desconhecidas
    expect(host.cellAt(1, 1).unknownAround).toBe(5);
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

describe('FleetRobotHost.pathTo — RN21', () => {
  it('menor caminho contornando o obstáculo conhecido e o robô visível', () => {
    const { fleet, host } = setup();
    // vai e volta pela esquerda para conhecer (0,2)
    fleet.move(1, Command.parse('ONN'));
    fleet.move(1, Command.parse('SSL'));

    // (0,1) é obstáculo e o 2 está em (1,0): sai pela esquerda
    expect(host.pathTo(0, 2)).toEqual([
      'stepLeft',
      'forward',
      'forward',
      'stepRight',
    ]);
  });

  it('os passos são relativos à orientação do robô', () => {
    const { fleet, host } = setup();
    fleet.move(1, Command.parse('D'));

    // olhando para o Leste, o Sul fica à direita e o Oeste atrás
    expect(host.pathTo(-1, -1)).toEqual(['stepRight', 'backward']);
  });

  it('só anda pelo que conhece: destino desconhecido não tem caminho', () => {
    const { host } = setup();

    expect(host.pathTo(-1, 3)).toBeNull();
  });

  it('CA83 — destino conhecido, mas só alcançável por casas desconhecidas: sem caminho', () => {
    const { host } = setup();

    // (1,1): (0,1) é obstáculo, o 2 está em (1,0) e (1,2)/(2,1) são desconhecidas
    expect(host.pathTo(1, 1)).toBeNull();
  });

  it('robô no destino: o caminho vai até ele (o último passo vai falhar)', () => {
    const { host } = setup();

    expect(host.pathTo(1, 0)).toEqual(['stepRight']);
  });

  it('já no destino: nenhum passo', () => {
    expect(setup().host.pathTo(0, 0)).toEqual([]);
  });

  it('sem caminho: destino fora da malha ou num obstáculo conhecido', () => {
    const { host } = setup();

    expect(host.pathTo(9, 9)).toBeNull();
    expect(host.pathTo(0, 1)).toBeNull();
  });

  it('cercado por obstáculos conhecidos e robôs visíveis: sem caminho', () => {
    // 1 em (0,0); obstáculo em (0,1) e (-1,0); 2 em (1,0) e 3 em (0,-1)
    const fleet = Fleet.place(
      Grid.square(3, [
        Obstacle.create([at(0, 1)]),
        Obstacle.create([at(-1, 0)]),
      ]),
      [{ position: at(0, 0) }, { position: at(1, 0) }, { position: at(0, -1) }],
    );
    const host = new FleetRobotHost(fleet, 1, () => undefined);

    expect(host.pathTo(-1, -1)).toBeNull();
    expect(host.nearestUnknown()).toBeNull();
  });
});

describe('FleetRobotHost.nearestUnknown — RN22', () => {
  it('CA84 — a casa conhecida mais próxima de onde se vê algo desconhecido', () => {
    const { host } = setup();

    // na frente há obstáculo e à direita o robô 2: a mais próxima é a de trás
    expect(host.nearestUnknown()).toMatchObject({
      type: 'empty',
      x: 0,
      y: -1,
      unknownAround: 3,
    });
  });

  it('mapa todo conhecido: null', () => {
    const fleet = Fleet.place(Grid.square(1), [{ position: at(0, 0) }]);
    const host = new FleetRobotHost(fleet, 1, () => undefined);

    expect(host.nearestUnknown()).toBeNull();
  });
});

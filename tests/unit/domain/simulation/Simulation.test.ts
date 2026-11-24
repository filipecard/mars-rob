import { describe, expect, it } from 'vitest';
import { Fleet } from '../../../../src/domain/entities/Fleet.js';
import { UnknownRobotError } from '../../../../src/domain/errors/UnknownRobotError.js';
import { ScriptSyntaxError } from '../../../../src/domain/script/ScriptError.js';
import { actionsOf } from '../../../../src/domain/simulation/Program.js';
import {
  Simulation,
  type SimulationEvent,
} from '../../../../src/domain/simulation/Simulation.js';
import { Command } from '../../../../src/domain/value-objects/Command.js';
import { Grid } from '../../../../src/domain/value-objects/Grid.js';
import { Obstacle } from '../../../../src/domain/value-objects/Obstacle.js';
import { Position } from '../../../../src/domain/value-objects/Position.js';

const at = (x: number, y: number): Position => Position.create(x, y);

// Malha limite 3, obstáculo em (0,2); robô 1 em (0,0) e robô 2 em (2,0)
function simulation(): Simulation {
  return new Simulation(
    Fleet.place(Grid.square(3, [Obstacle.create([at(0, 2)])]), [
      { position: at(0, 0) },
      { position: at(2, 0) },
    ]),
  );
}

function runAll(sim: Simulation, maxTicks = 100): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  for (let i = 0; i < maxTicks && !sim.idle; i++) {
    events.push(...sim.advance());
  }
  return events;
}

const summary = (events: SimulationEvent[]): string[] =>
  events.map((e) => `${String(e.tick)}:${String(e.robot)}:${e.kind}`);

const positionOf = (sim: Simulation, id: number): string => {
  const { x, y } = sim.fleet.robot(id).position;
  return `${String(x)},${String(y)}`;
};

describe('Simulation — relógio — RN17', () => {
  it('sem programas, o tick conta (o mundo anda), mas nenhum robô faz nada', () => {
    const sim = simulation();

    expect(sim.advance()).toEqual([]);
    expect(sim.tick).toBe(1);
    expect(sim.idle).toBe(true);
  });

  it('cada robô faz no máximo 1 ação por tick, em ordem de ID', () => {
    const sim = simulation();
    sim.giveOrder(2, actionsOf(Command.parse('NN')));
    sim.giveOrder(1, actionsOf(Command.parse('N')));

    expect(summary(sim.advance())).toEqual(['1:1:moved', '1:2:moved']);
    expect(sim.running).toEqual([1, 2]);
    expect(summary(sim.advance())).toEqual(['2:1:finished', '2:2:moved']);
    expect(summary(sim.advance())).toEqual(['3:2:finished']);
    expect(sim.idle).toBe(true);
  });

  it('eventos de movimento, giro e espera', () => {
    const sim = simulation();
    sim.loadScript(1, 'forward(); turnRight(); wait()');

    expect(runAll(sim)).toEqual([
      {
        tick: 1,
        robot: 1,
        kind: 'moved',
        position: at(0, 1),
        orientation: 'N',
      },
      {
        tick: 2,
        robot: 1,
        kind: 'turned',
        position: at(0, 1),
        orientation: 'L',
      },
      { tick: 3, robot: 1, kind: 'waited' },
      { tick: 4, robot: 1, kind: 'finished' },
    ]);
  });

  it('stop encerra o programa do robô', () => {
    const sim = simulation();
    sim.giveOrder(1, actionsOf(Command.parse('NNN')));

    expect(sim.stop(1)).toBe(true);
    expect(sim.stop(1)).toBe(false);
    expect(sim.programOf(1)).toBeNull();
  });

  it('robô inexistente', () => {
    const sim = simulation();

    expect(() => {
      sim.giveOrder(9, []);
    }).toThrow(UnknownRobotError);
    expect(() => {
      sim.loadScript(9, '');
    }).toThrow(UnknownRobotError);
    expect(() => sim.stop(9)).toThrow(UnknownRobotError);
    expect(() => sim.programOf(9)).toThrow(UnknownRobotError);
  });
});

describe('Simulation — ordens e scripts — RN17, RN18', () => {
  it('ordens novas entram na fila das ordens em andamento', () => {
    const sim = simulation();
    sim.giveOrder(1, actionsOf(Command.parse('N')));
    sim.giveOrder(1, actionsOf(Command.parse('O')));

    runAll(sim);

    expect(positionOf(sim, 1)).toBe('-1,1');
  });

  it('uma ordem substitui o script que estava rodando', () => {
    const sim = simulation();
    sim.loadScript(1, 'while (true) { wait() }');
    sim.giveOrder(1, actionsOf(Command.parse('S')));

    expect(sim.programOf(1)).toBe('orders');
    runAll(sim);
    expect(positionOf(sim, 1)).toBe('0,-1');
  });

  it('um script substitui o programa anterior', () => {
    const sim = simulation();
    sim.giveOrder(1, actionsOf(Command.parse('NNN')));
    sim.loadScript(1, 'backward()');

    expect(sim.programOf(1)).toBe('script');
    runAll(sim);
    expect(positionOf(sim, 1)).toBe('0,-1');
  });

  it('erro de sintaxe não troca o programa', () => {
    const sim = simulation();
    sim.giveOrder(1, actionsOf(Command.parse('N')));

    expect(() => {
      sim.loadScript(1, 'while (');
    }).toThrow(ScriptSyntaxError);
    expect(sim.programOf(1)).toBe('orders');
  });

  it('a ação devolve false quando bate, e o script decide o que fazer', () => {
    const sim = simulation();
    sim.loadScript(
      1,
      `
      while (forward()) {}
      print('parei em', self.position, 'por causa de', type(front()))
      `,
    );

    const events = runAll(sim);

    expect(events).toContainEqual({
      tick: 2,
      robot: 1,
      kind: 'blocked',
      reason: 'obstacle',
      at: at(0, 2),
      other: null,
    });
    expect(events).toContainEqual({
      tick: 3,
      robot: 1,
      kind: 'printed',
      text: 'parei em (0, 1) por causa de obstacle',
    });
  });

  it('bater na borda e em outro robô', () => {
    const sim = simulation();
    sim.loadScript(
      1,
      'stepRight(); stepRight(); turnRight(); turnRight(); while (backward()) {}',
    );
    sim.loadScript(2, 'wait(); wait()');

    const blocked = runAll(sim).filter((e) => e.kind === 'blocked');

    expect(blocked).toEqual([
      {
        tick: 2,
        robot: 1,
        kind: 'blocked',
        reason: 'robot',
        at: at(2, 0),
        other: 2,
      },
      {
        tick: 8,
        robot: 1,
        kind: 'blocked',
        reason: 'edge',
        at: at(1, 4),
        other: null,
      },
    ]);
  });

  it('erro de execução encerra o programa com linha e coluna', () => {
    const sim = simulation();
    sim.loadScript(1, 'forward()\nlet x = y');

    expect(runAll(sim).at(-1)).toEqual({
      tick: 2,
      robot: 1,
      kind: 'error',
      message: '"y" não foi declarado',
      line: 2,
      column: 9,
    });
    expect(sim.idle).toBe(true);
  });

  it('o script vê os outros robôs pelos sensores', () => {
    const sim = simulation();
    sim.loadScript(
      1,
      `
      stepRight()
      if (type(right()) == 'robot') { print('vizinho', right().robot) }
      `,
    );

    expect(runAll(sim)).toContainEqual(
      expect.objectContaining({ kind: 'printed', text: 'vizinho 2' }),
    );
  });
});

describe('Simulation — compartilhar mapa — RN16', () => {
  it('compartilha com o vizinho', () => {
    const sim = simulation();
    sim.loadScript(1, 'stepRight(); shareMap(2)');

    expect(runAll(sim)).toContainEqual({
      tick: 2,
      robot: 1,
      kind: 'shared',
      to: 2,
      added: 6,
    });
  });

  it.each([
    [2, 'notAdjacent'],
    [9, 'unknownRobot'],
    [1, 'self'],
  ])('shareMap(%i) falha: %s', (to, reason) => {
    const sim = simulation();
    sim.loadScript(1, `print(shareMap(${String(to)}))`);

    const events = runAll(sim);

    expect(events).toContainEqual({
      tick: 1,
      robot: 1,
      kind: 'shareFailed',
      to,
      reason,
    });
    expect(events).toContainEqual(
      expect.objectContaining({ kind: 'printed', text: 'false' }),
    );
  });
});

describe('Simulation — apagar o mapa — RN20', () => {
  it('CA77 — forgetMap() no script gasta 1 tick e diz quantas casas esqueceu', () => {
    const sim = simulation();
    sim.loadScript(1, 'forward(); print(forgetMap())');

    const events = runAll(sim);

    expect(summary(events)).toEqual([
      '1:1:moved',
      '2:1:forgot',
      '3:1:printed',
      '3:1:finished',
    ]);
    // de (0,0) para (0,1): conhecia y de -1 a 2 (12 casas); fica com 9
    expect(events[1]).toMatchObject({ kind: 'forgot', forgotten: 3 });
    expect(events[2]).toMatchObject({ text: 'true' });
  });

  it('o operador apaga fora dos ticks, sem mexer no programa nem nos outros robôs', () => {
    const sim = simulation();
    sim.loadScript(1, 'forward(); forward()');
    sim.advance();
    const otherBefore = sim.fleet.robot(2).explored.length;

    expect(sim.forgetMap(1)).toBe(3);
    expect(sim.tick).toBe(1);
    expect(sim.programOf(1)).toBe('script');
    expect(sim.fleet.robot(2).explored).toHaveLength(otherBefore);
  });

  it('robô inexistente', () => {
    expect(() => simulation().forgetMap(9)).toThrow(UnknownRobotError);
  });
});

describe('Simulation — goTo — RN21', () => {
  it('chega ao destino pelo menor caminho, um passo por tick', () => {
    // anda para trás para conhecer (-1,-2) e vai até lá: 1 + 2 passos
    const sim = simulation();
    sim.loadScript(1, 'backward(); print(goTo(-1, -2))');

    const events = runAll(sim);

    expect(events.filter((e) => e.kind === 'moved')).toHaveLength(3);
    expect(positionOf(sim, 1)).toBe('-1,-2');
    // não gira: continua olhando para o Norte
    expect(sim.fleet.robot(1).orientation).toBe('N');
    expect(events).toContainEqual(
      expect.objectContaining({ kind: 'printed', text: 'true' }),
    );
  });

  it('CA80 — destino desconhecido: devolve false sem andar', () => {
    const sim = simulation();
    sim.loadScript(1, 'print(goTo(0, 3), self.position)');

    const events = runAll(sim);

    expect(events.some((e) => e.kind === 'moved')).toBe(false);
    expect(events).toContainEqual(
      expect.objectContaining({ kind: 'printed', text: 'false (0, 0)' }),
    );
  });

  it('CA85 — com nearestUnknown e goTo o robô explora a malha toda', () => {
    const sim = simulation();
    sim.loadScript(
      1,
      `let c = nearestUnknown();
      while (c != null) {
        goTo(c.position.x, c.position.y);
        c = nearestUnknown();
      }
      print(explored())`,
    );

    const events = runAll(sim, 500);

    // malha 7x7 = 49 casas
    expect(events).toContainEqual(
      expect.objectContaining({ kind: 'printed', text: '49' }),
    );
  });
});

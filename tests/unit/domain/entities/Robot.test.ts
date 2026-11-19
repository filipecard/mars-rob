import { describe, expect, it } from 'vitest';
import { Robot } from '../../../../src/domain/entities/Robot.js';
import { CollisionError } from '../../../../src/domain/errors/CollisionError.js';
import { ObstacleError } from '../../../../src/domain/errors/ObstacleError.js';
import { OutOfGridError } from '../../../../src/domain/errors/OutOfGridError.js';
import { Command } from '../../../../src/domain/value-objects/Command.js';
import { Grid } from '../../../../src/domain/value-objects/Grid.js';
import { Obstacle } from '../../../../src/domain/value-objects/Obstacle.js';
import { Position } from '../../../../src/domain/value-objects/Position.js';

describe('Robot', () => {
  const grid = Grid.standard();

  it('começa na origem por padrão — RN01', () => {
    expect(Robot.create(grid).position.equals(Position.origin())).toBe(true);
  });

  it('começa orientado para o Norte por padrão — RN01', () => {
    expect(Robot.create(grid).orientation).toBe('N');
  });

  it('não pode ser criado fora da malha', () => {
    expect(() => Robot.create(grid, Position.create(16, 0))).toThrow(
      OutOfGridError,
    );
  });

  it('executa todos os passos do comando', () => {
    const robot = Robot.create(grid);

    robot.execute(Command.parse('NLLSSSS'));

    expect(robot.position.equals(Position.create(2, -3))).toBe(true);
  });

  it('não atravessa a borda nem que volte depois — RN04', () => {
    const robot = Robot.create(grid, Position.create(0, 15));

    expect(() => {
      robot.execute(Command.parse('NS'));
    }).toThrow(OutOfGridError);
  });

  it('mantém a posição quando o comando é rejeitado — RN05', () => {
    const robot = Robot.create(grid, Position.create(0, 14));

    expect(() => {
      robot.execute(Command.parse('LNN'));
    }).toThrow(OutOfGridError);
    expect(robot.position.equals(Position.create(0, 14))).toBe(true);
  });

  it.each<[string, number, number, string]>([
    ['D', 0, 0, 'L'],
    ['E', 0, 0, 'O'],
    ['DDDD', 0, 0, 'N'],
    ['DN', 1, 0, 'L'],
    ['DDN', 0, -1, 'S'],
    ['DDS', 0, 1, 'S'],
    ['DL', 0, -1, 'L'],
    ['EN', -1, 0, 'O'],
  ])(
    '"%s" leva a (%i,%i) olhando para %s — RN03, RN08',
    (input, x, y, orientation) => {
      const robot = Robot.create(grid);

      robot.execute(Command.parse(input));

      expect(robot.position.equals(Position.create(x, y))).toBe(true);
      expect(robot.orientation).toBe(orientation);
    },
  );

  it('respeita a ordem entre giros e passos', () => {
    const robot = Robot.create(grid);

    robot.execute(Command.parse('NDNEN'));

    expect(robot.position.equals(Position.create(1, 2))).toBe(true);
    expect(robot.orientation).toBe('N');
  });

  it('mantém posição e orientação quando o comando é rejeitado — RN05', () => {
    const robot = Robot.create(grid);

    expect(() => {
      robot.execute(Command.parse(`D${'N'.repeat(16)}`));
    }).toThrow(OutOfGridError);
    expect(robot.position.equals(Position.origin())).toBe(true);
    expect(robot.orientation).toBe('N');
  });

  it('a orientação persiste entre comandos — RN06', () => {
    const robot = Robot.create(grid);

    robot.execute(Command.parse('D'));
    robot.execute(Command.parse('N'));

    expect(robot.position.equals(Position.create(1, 0))).toBe(true);
    expect(robot.orientation).toBe('L');
  });

  describe('obstáculos — RN09', () => {
    const blocked = Grid.square(15, [Obstacle.create([Position.create(0, 2)])]);

    it('não pode ser criado em cima de um obstáculo', () => {
      expect(() => Robot.create(blocked, Position.create(0, 2))).toThrow(
        ObstacleError,
      );
    });

    it('rejeita o comando inteiro ao bater no obstáculo — RN05', () => {
      const robot = Robot.create(blocked);

      expect(() => {
        robot.execute(Command.parse('DDSS'));
      }).toThrow(ObstacleError);
      expect(robot.position.equals(Position.origin())).toBe(true);
      expect(robot.orientation).toBe('N');
    });

    it('não pode atravessar o obstáculo nem que pare depois dele', () => {
      const robot = Robot.create(blocked);

      expect(() => {
        robot.execute(Command.parse('NNNN'));
      }).toThrow(ObstacleError);
    });

    it('informa onde está o obstáculo', () => {
      const robot = Robot.create(blocked);

      try {
        robot.execute(Command.parse('DDSS'));
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(ObstacleError);
        expect(
          (error as ObstacleError).position.equals(Position.create(0, 2)),
        ).toBe(true);
      }
    });

    it('pode contornar o obstáculo', () => {
      const robot = Robot.create(blocked);

      robot.execute(Command.parse('NLNNO'));

      expect(robot.position.equals(Position.create(0, 3))).toBe(true);
    });
  });

  describe('exploração — RN12', () => {
    const keys = (robot: Robot): string[] =>
      robot.explored.map(({ x, y }) => `${String(x)},${String(y)}`).sort();

    // Quadrado de visão em volta de (cx, cy), cortado nos limites
    function square(cx: number, cy: number, limit = 15): string[] {
      const result: string[] = [];
      for (let x = cx - 1; x <= cx + 1; x++) {
        for (let y = cy - 1; y <= cy + 1; y++) {
          if (Math.abs(x) <= limit && Math.abs(y) <= limit) {
            result.push(`${String(x)},${String(y)}`);
          }
        }
      }
      return result;
    }

    const union = (...areas: string[][]): string[] =>
      [...new Set(areas.flat())].sort();

    it('ao ser criado vê a própria casa e as 8 em volta', () => {
      const robot = Robot.create(grid);

      expect(keys(robot)).toEqual(union(square(0, 0)));
      expect(robot.hasExplored(Position.create(1, 1))).toBe(true);
      expect(robot.hasExplored(Position.create(2, 0))).toBe(false);
    });

    it('revela a vizinhança de cada casa do caminho, não só do destino', () => {
      const robot = Robot.create(grid);

      robot.execute(Command.parse('NNN'));

      expect(keys(robot)).toEqual(
        union(square(0, 0), square(0, 1), square(0, 2), square(0, 3)),
      );
    });

    it('girar não revela nada novo', () => {
      const robot = Robot.create(grid);

      robot.execute(Command.parse('DDDE'));

      expect(keys(robot)).toEqual(union(square(0, 0)));
    });

    it('a exploração se acumula entre comandos', () => {
      const robot = Robot.create(grid);

      robot.execute(Command.parse('LL'));
      robot.execute(Command.parse('OOOO'));

      expect(keys(robot)).toEqual(
        union(...[-2, -1, 0, 1, 2].map((x) => square(x, 0))),
      );
    });

    it('comando rejeitado não revela nada — RN05', () => {
      const robot = Robot.create(grid);

      expect(() => {
        robot.execute(Command.parse('N'.repeat(16)));
      }).toThrow(OutOfGridError);
      expect(keys(robot)).toEqual(union(square(0, 0)));
    });

    it('não revela casas fora da malha', () => {
      const robot = Robot.create(grid, Position.create(15, 15));

      expect(keys(robot)).toEqual(union(square(15, 15)));
      expect(robot.explored).toHaveLength(4);
    });

    it('enxerga obstáculos vizinhos sem precisar bater neles', () => {
      const withObstacle = Grid.square(15, [
        Obstacle.create([Position.create(1, 1)]),
      ]);

      const robot = Robot.create(withObstacle);

      expect(robot.hasExplored(Position.create(1, 1))).toBe(true);
    });
  });

  describe('casas visitadas — RN19', () => {
    it('a casa inicial conta como visitada; as vizinhas só foram vistas', () => {
      const robot = Robot.create(grid);

      expect(robot.hasVisited(Position.origin())).toBe(true);
      expect(robot.hasVisited(Position.create(0, 1))).toBe(false);
    });

    it('cada passo do caminho é visitado; giros não mudam nada', () => {
      const robot = Robot.create(grid);

      robot.execute(Command.parse('NDN'));

      expect(robot.hasVisited(Position.create(0, 1))).toBe(true);
      expect(robot.hasVisited(Position.create(1, 1))).toBe(true);
      expect(robot.hasVisited(Position.create(1, 0))).toBe(false);
    });

    it('comando rejeitado não visita nada — RN05', () => {
      const robot = Robot.create(grid);

      expect(() => {
        robot.execute(Command.parse('N'.repeat(16)));
      }).toThrow(OutOfGridError);
      expect(robot.hasVisited(Position.create(0, 1))).toBe(false);
    });

    it('receber um mapa não marca casas como visitadas — RN16', () => {
      const robot = Robot.create(grid);

      robot.receiveMap([Position.create(5, 5)]);

      expect(robot.hasExplored(Position.create(5, 5))).toBe(true);
      expect(robot.hasVisited(Position.create(5, 5))).toBe(false);
    });
  });

  describe('apagar o mapa — RN20', () => {
    it('esquece tudo e volta a conhecer só o 3x3 de onde está', () => {
      const robot = Robot.create(grid);
      robot.execute(Command.parse('NNN'));

      // conhecia x de -1 a 1 e y de -1 a 4 (18 casas); fica com o 3x3 de (0,3)
      expect(robot.forgetMap()).toBe(9);
      expect(robot.explored).toHaveLength(9);
      expect(robot.hasExplored(Position.create(0, 0))).toBe(false);
      expect(robot.hasExplored(Position.create(1, 4))).toBe(true);
    });

    it('esquece as casas visitadas, menos a casa onde está', () => {
      const robot = Robot.create(grid);
      robot.execute(Command.parse('NN'));

      robot.forgetMap();

      expect(robot.hasVisited(Position.create(0, 0))).toBe(false);
      expect(robot.hasVisited(Position.create(0, 1))).toBe(false);
      expect(robot.hasVisited(Position.create(0, 2))).toBe(true);
    });

    it('logo depois de nascer não há nada a esquecer', () => {
      expect(Robot.create(grid).forgetMap()).toBe(0);
    });
  });

  describe('outros robôs — RN15', () => {
    const occupiedBy2 = (position: Position): number | undefined =>
      position.equals(Position.create(0, 2)) ? 2 : undefined;

    it('rejeita o comando que passa por outro robô e mantém o estado', () => {
      const robot = Robot.create(grid);

      expect(() => {
        robot.execute(Command.parse('DNENNN'), occupiedBy2);
      }).not.toThrow();
      const blocked = Robot.create(grid);
      expect(() => {
        blocked.execute(Command.parse('NNN'), occupiedBy2);
      }).toThrow(CollisionError);
      expect(blocked.position.equals(Position.origin())).toBe(true);
    });
  });

  it.each<[number, number, boolean]>([
    [1, 1, true],
    [-1, 0, true],
    [2, 0, false],
    [0, -2, false],
  ])('vê (%i,%i) estando na origem: %s — RN12', (x, y, expected) => {
    expect(Robot.create(grid).canSee(Position.create(x, y))).toBe(expected);
  });

  describe('compartilhar mapa — RN16', () => {
    it('soma só as casas novas e conta quantas eram', () => {
      const robot = Robot.create(grid);

      const added = robot.receiveMap([
        Position.create(0, 0),
        Position.create(5, 5),
        Position.create(5, 6),
        Position.create(5, 6),
      ]);

      expect(added).toBe(2);
      expect(robot.hasExplored(Position.create(5, 6))).toBe(true);
    });

    it('ignora casas fora da malha', () => {
      expect(Robot.create(grid).receiveMap([Position.create(16, 0)])).toBe(0);
    });

    it.each<[number, number, boolean]>([
      [0, 1, true],
      [1, 0, true],
      [0, -1, true],
      [-1, 0, true],
      [1, 1, false],
      [0, 2, false],
    ])('(0,0) e (%i,%i) lado a lado: %s', (x, y, expected) => {
      const robot = Robot.create(grid);
      const other = Robot.create(grid, Position.create(x, y));

      expect(robot.isNextTo(other)).toBe(expected);
    });
  });
});

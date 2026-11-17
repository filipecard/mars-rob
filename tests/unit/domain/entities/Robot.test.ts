import { describe, expect, it } from 'vitest';
import { Robot } from '../../../../src/domain/entities/Robot.js';
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
});

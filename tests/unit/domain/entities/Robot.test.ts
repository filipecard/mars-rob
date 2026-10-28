import { describe, expect, it } from 'vitest';
import { Robot } from '../../../../src/domain/entities/Robot.js';
import { OutOfGridError } from '../../../../src/domain/errors/OutOfGridError.js';
import { Command } from '../../../../src/domain/value-objects/Command.js';
import { Grid } from '../../../../src/domain/value-objects/Grid.js';
import { Position } from '../../../../src/domain/value-objects/Position.js';

describe('Robot', () => {
  const grid = Grid.standard();

  it('começa na origem por padrão — RN01', () => {
    expect(Robot.create(grid).position.equals(Position.origin())).toBe(true);
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
});

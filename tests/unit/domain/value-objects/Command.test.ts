import { describe, expect, it } from 'vitest';
import { InvalidCommandError } from '../../../../src/domain/errors/InvalidCommandError.js';
import { Command } from '../../../../src/domain/value-objects/Command.js';

describe('Command', () => {
  it('converte cada letra em uma instrução', () => {
    expect(Command.parse('NLLS').instructions).toEqual(['N', 'L', 'L', 'S']);
  });

  it('mantém passos e giros na ordem digitada', () => {
    expect(Command.parse('DNEN').instructions).toEqual(['D', 'N', 'E', 'N']);
  });

  it.each(['D', 'E'])('aceita o giro "%s" — RN07, RN08', (input) => {
    expect(Command.parse(input).instructions).toEqual([input]);
  });

  it('aceita entrada vazia como comando sem passos — RN07', () => {
    expect(Command.parse('').instructions).toEqual([]);
  });

  it.each(['n', 'd', 'e', 'N L', ' N', 'N ', '1N', 'N1', 'X', 'NXN', 'DX'])(
    'rejeita "%s" — RN07',
    (input) => {
      expect(() => Command.parse(input)).toThrow(InvalidCommandError);
    },
  );
});

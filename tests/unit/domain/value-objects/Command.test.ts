import { describe, expect, it } from 'vitest';
import { InvalidCommandError } from '../../../../src/domain/errors/InvalidCommandError.js';
import { Command } from '../../../../src/domain/value-objects/Command.js';

describe('Command', () => {
  it('converte cada letra em uma direção', () => {
    expect(Command.parse('NLLS').directions).toEqual(['N', 'L', 'L', 'S']);
  });

  it('aceita entrada vazia como comando sem passos — RN07', () => {
    expect(Command.parse('').directions).toEqual([]);
  });

  it.each(['n', 'N L', ' N', 'N ', '1N', 'N1', 'X', 'NXN', 'NE'])(
    'rejeita "%s" — RN07',
    (input) => {
      expect(() => Command.parse(input)).toThrow(InvalidCommandError);
    },
  );
});

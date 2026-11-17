import { describe, expect, it } from 'vitest';
import { InvalidCommandError } from '../../../../src/domain/errors/InvalidCommandError.js';
import { InvalidOrderError } from '../../../../src/domain/errors/InvalidOrderError.js';
import {
  parseOrder,
  splitOrders,
} from '../../../../src/domain/value-objects/Order.js';

describe('parseOrder', () => {
  it('lê o ID do robô e o comando — RN14', () => {
    const order = parseOrder('2:DNE');

    expect(order).toMatchObject({ kind: 'move', robotId: 2 });
    expect(order.kind === 'move' && order.command.instructions).toEqual([
      'D',
      'N',
      'E',
    ]);
  });

  it('aceita comando vazio — RN07', () => {
    const order = parseOrder('1:');

    expect(order.kind === 'move' && order.command.instructions).toEqual([]);
  });

  it('aceita IDs com mais de um dígito', () => {
    expect(parseOrder('12:N')).toMatchObject({ kind: 'move', robotId: 12 });
  });

  it('lê o compartilhamento de mapa — RN16', () => {
    expect(parseOrder('1>2')).toEqual({ kind: 'share', from: 1, to: 2 });
  });

  it.each([
    'NN',
    ':N',
    '0:N',
    '01:N',
    'a:N',
    '1-N',
    '1>',
    '>2',
    '1>1',
    '1>2>3',
    '1>a',
  ])('rejeita o formato "%s"', (input) => {
    expect(() => parseOrder(input)).toThrow(InvalidOrderError);
  });

  it.each(['1:n', '1:NX', '1:1', '1:N:N'])(
    'rejeita letras inválidas no comando "%s" — RN07',
    (input) => {
      expect(() => parseOrder(input)).toThrow(InvalidCommandError);
    },
  );
});

describe('splitOrders', () => {
  it('separa as ordens por espaço — RN14', () => {
    expect(splitOrders('1:NN 2:DE 1>2')).toEqual(['1:NN', '2:DE', '1>2']);
  });

  it('ignora espaços repetidos e nas pontas', () => {
    expect(splitOrders('  1:N   2:S ')).toEqual(['1:N', '2:S']);
  });

  it('linha vazia não tem ordens', () => {
    expect(splitOrders('')).toEqual([]);
    expect(splitOrders('   ')).toEqual([]);
  });
});

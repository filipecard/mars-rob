import { describe, expect, it } from 'vitest';
import type { Direction } from '../../../../src/domain/value-objects/Direction.js';
import {
  isTurn,
  toAbsolute,
  turn,
  turnLeft,
  turnRight,
  type Orientation,
  type Turn,
} from '../../../../src/domain/value-objects/Orientation.js';

describe('Orientation', () => {
  it.each<[Orientation, Orientation]>([
    ['N', 'L'],
    ['L', 'S'],
    ['S', 'O'],
    ['O', 'N'],
  ])('turnRight de %s leva a %s — RN08', (orientation, expected) => {
    expect(turnRight(orientation)).toBe(expected);
  });

  it.each<[Orientation, Orientation]>([
    ['N', 'O'],
    ['O', 'S'],
    ['S', 'L'],
    ['L', 'N'],
  ])('turnLeft de %s leva a %s — RN08', (orientation, expected) => {
    expect(turnLeft(orientation)).toBe(expected);
  });

  it.each<Orientation>(['N', 'L', 'S', 'O'])(
    '4 giros para cada lado a partir de %s voltam à mesma orientação — RN08',
    (orientation) => {
      const right = turnRight(turnRight(turnRight(turnRight(orientation))));
      const left = turnLeft(turnLeft(turnLeft(turnLeft(orientation))));

      expect(right).toBe(orientation);
      expect(left).toBe(orientation);
    },
  );

  it.each<[Orientation, Turn, Orientation]>([
    ['N', 'D', 'L'],
    ['N', 'E', 'O'],
    ['S', 'D', 'O'],
    ['S', 'E', 'L'],
  ])(
    'olhando para %s, o giro %s leva a %s — RN08',
    (orientation, t, expected) => {
      expect(turn(orientation, t)).toBe(expected);
    },
  );

  it.each(['D', 'E'])('"%s" é giro', (value) => {
    expect(isTurn(value)).toBe(true);
  });

  it.each(['N', 'd', 'e', '', 'DD'])('"%s" não é giro', (value) => {
    expect(isTurn(value)).toBe(false);
  });

  it.each<[Orientation, Direction, Direction]>([
    ['N', 'N', 'N'],
    ['N', 'S', 'S'],
    ['N', 'L', 'L'],
    ['N', 'O', 'O'],
    ['L', 'N', 'L'],
    ['L', 'S', 'O'],
    ['L', 'L', 'S'],
    ['L', 'O', 'N'],
    ['S', 'N', 'S'],
    ['S', 'S', 'N'],
    ['S', 'L', 'O'],
    ['S', 'O', 'L'],
    ['O', 'N', 'O'],
    ['O', 'S', 'L'],
    ['O', 'L', 'N'],
    ['O', 'O', 'S'],
  ])(
    'olhando para %s, o passo relativo %s vai para %s no grid — RN03',
    (orientation, relative, expected) => {
      expect(toAbsolute(orientation, relative)).toBe(expected);
    },
  );
});

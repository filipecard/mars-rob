import { describe, expect, it } from 'vitest';
import type { GridDTO } from '../../../src/application/dto.js';
import { formatMap } from '../../../src/presentation/cli/formatMap.js';

describe('formatMap', () => {
  const base: GridDTO = {
    min: -2,
    max: 2,
    obstacles: [
      [
        { x: -1, y: 1 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
      [
        { x: 1, y: -1 },
        { x: 1, y: -2 },
      ],
    ],
    robot: { x: 0, y: 0, orientation: 'N' },
  };

  it('desenha com o Norte para cima e obstáculos com #', () => {
    expect(formatMap(base)).toBe(
      ['. . . . .', '. # # # .', '. . ^ . .', '. . . # .', '. . . # .'].join(
        '\n',
      ),
    );
  });

  it.each([
    ['N', '^'],
    ['L', '>'],
    ['S', 'v'],
    ['O', '<'],
  ] as const)(
    'o robô olhando para %s aparece como %s',
    (orientation, symbol) => {
      const map = formatMap({
        ...base,
        robot: { x: -2, y: 2, orientation },
      });

      expect(map.split('\n')[0]).toBe(`${symbol} . . . .`);
    },
  );
});

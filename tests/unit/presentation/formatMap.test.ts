import { describe, expect, it } from 'vitest';
import type { CellDTO, GridDTO } from '../../../src/application/dto.js';
import {
  formatExploration,
  formatMap,
  formatMapView,
} from '../../../src/presentation/cli/formatMap.js';

// Visão inicial em volta da origem, com um obstáculo visto em (1,1)
const around: CellDTO[] = [-1, 0, 1].flatMap((x) =>
  [-1, 0, 1].map((y) => ({ x, y, blocked: x === 1 && y === 1 })),
);

const base: GridDTO = {
  min: -2,
  max: 2,
  obstacleCount: 3,
  explored: around,
  robot: { x: 0, y: 0, orientation: 'N' },
};

describe('formatMap', () => {
  it('mostra só o que foi explorado; o resto fica desconhecido — RN12', () => {
    expect(formatMap(base)).toBe(
      ['? ? ? ? ?', '? . . # ?', '? . ^ . ?', '? . . . ?', '? ? ? ? ?'].join(
        '\n',
      ),
    );
  });

  it('sem nada explorado, tudo é desconhecido menos o robô', () => {
    expect(formatMap({ ...base, explored: [] })).toBe(
      ['? ? ? ? ?', '? ? ? ? ?', '? ? ^ ? ?', '? ? ? ? ?', '? ? ? ? ?'].join(
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
      const map = formatMap({ ...base, robot: { x: -2, y: 2, orientation } });

      expect(map.split('\n')[0]).toBe(`${symbol} ? ? ? ?`);
    },
  );
});

describe('formatExploration', () => {
  it('conta as casas exploradas sobre o total da malha', () => {
    expect(formatExploration(base)).toBe('Explorado: 9 de 25 casas');
  });
});

describe('formatMapView', () => {
  it('junta mapa, exploração e legenda', () => {
    const lines = formatMapView(base).split('\n');

    expect(lines).toHaveLength(7);
    expect(lines[5]).toBe('Explorado: 9 de 25 casas');
    expect(lines[6]).toBe(
      'Legenda: ^ > v < robô (para onde olha)   # obstáculo   . livre   ? desconhecido',
    );
  });
});

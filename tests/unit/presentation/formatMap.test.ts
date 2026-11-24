import { describe, expect, it } from 'vitest';
import type { CellDTO, MapDTO } from '../../../src/application/dto.js';
import {
  formatExploration,
  formatMap,
  formatMapView,
} from '../../../src/presentation/cli/formatMap.js';

// Visão inicial em volta da origem, com um obstáculo visto em (1,1)
const around: CellDTO[] = [-1, 0, 1].flatMap((x) =>
  [-1, 0, 1].map((y) => ({
    x,
    y,
    blocked: x === 1 && y === 1,
    visited: x === 0 && y === 0,
    ground: x === 1 && y === 1 ? ('rock' as const) : ('free' as const),
    item: null,
  })),
);

const base: MapDTO = {
  min: -2,
  max: 2,
  explored: around,
  robot: { id: 1, x: 0, y: 0, orientation: 'N' },
  others: [],
  base: { x: 0, y: 0 },
  visionRange: 1,
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
      const map = formatMap({
        ...base,
        robot: { id: 1, x: -2, y: 2, orientation },
      });

      expect(map.split('\n')[0]).toBe(`${symbol} ? ? ? ?`);
    },
  );

  it('os outros robôs aparecem pelo ID', () => {
    const map = formatMap({
      ...base,
      others: [{ id: 3, x: -1, y: 0, orientation: 'S' }],
    });

    expect(map.split('\n')[2]).toBe('? 3 ^ . ?');
  });
});

describe('formatExploration', () => {
  it('conta as casas exploradas sobre o total da malha', () => {
    expect(formatExploration(base)).toBe('Explorado: 9 de 25 casas');
  });
});

describe('formatMapView', () => {
  it('junta título, mapa, exploração e legenda', () => {
    const lines = formatMapView({
      ...base,
      robot: { ...base.robot, id: 2 },
    }).split('\n');

    expect(lines).toHaveLength(9);
    expect(lines[0]).toBe('Mapa do robô 2');
    expect(lines[6]).toBe('Explorado: 9 de 25 casas');
    expect(lines[7]).toBe(
      'Legenda: ^ > v < robô 2 (para onde olha)   número outro robô   ? desconhecido   . livre',
    );
    expect(lines[8]).toBe(
      '         B base   # rocha   T árvore   $ jazida   , galho   o pedra   = tronco   % ferro',
    );
  });
});

import type { MapDTO, OrientationDTO } from '../api/types.js';

// RN19: 'visited' é chão onde o robô já pisou; 'seen' é chão que ele só viu de perto
export type CellKind =
  'unknown' | 'visited' | 'seen' | 'obstacle' | 'self' | 'other';

export interface MapCell {
  x: number;
  y: number;
  kind: CellKind;
  // ID do robô na casa (só em 'self' e 'other')
  robotId: number | null;
  orientation: OrientationDTO | null;
}

const key = (x: number, y: number): string => `${String(x)},${String(y)}`;

// Norte para cima: a primeira linha é y = max. Mesmas regras do mapa da CLI (RN12).
export function mapRows(map: MapDTO): MapCell[][] {
  const known = new Map(map.explored.map((c) => [key(c.x, c.y), c]));
  const others = new Map(map.others.map((r) => [key(r.x, r.y), r]));
  const rows: MapCell[][] = [];
  for (let y = map.max; y >= map.min; y--) {
    const row: MapCell[] = [];
    for (let x = map.min; x <= map.max; x++) {
      row.push(cellAt(x, y));
    }
    rows.push(row);
  }
  return rows;

  function cellAt(x: number, y: number): MapCell {
    const { robot } = map;
    if (robot.x === x && robot.y === y) {
      return {
        x,
        y,
        kind: 'self',
        robotId: robot.id,
        orientation: robot.orientation,
      };
    }
    const other = others.get(key(x, y));
    if (other !== undefined) {
      return {
        x,
        y,
        kind: 'other',
        robotId: other.id,
        orientation: other.orientation,
      };
    }
    const cell = known.get(key(x, y));
    const kind: CellKind =
      cell === undefined
        ? 'unknown'
        : cell.blocked
          ? 'obstacle'
          : cell.visited
            ? 'visited'
            : 'seen';
    return { x, y, kind, robotId: null, orientation: null };
  }
}

export function exploration(map: MapDTO): { known: number; total: number } {
  const side = map.max - map.min + 1;
  return { known: map.explored.length, total: side * side };
}

export const ORIENTATION_NAMES: Record<OrientationDTO, string> = {
  N: 'Norte',
  L: 'Leste',
  S: 'Sul',
  O: 'Oeste',
};

export const ORIENTATION_ARROWS: Record<OrientationDTO, string> = {
  N: '▲',
  L: '▶',
  S: '▼',
  O: '◀',
};

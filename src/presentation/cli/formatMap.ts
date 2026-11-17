import type { GridDTO, OrientationDTO } from '../../application/dto.js';

const ROBOT_SYMBOLS: Record<OrientationDTO, string> = {
  N: '^',
  L: '>',
  S: 'v',
  O: '<',
};

export const OBSTACLE_SYMBOL = '#';
export const FREE_SYMBOL = '.';
export const UNKNOWN_SYMBOL = '?';

export const MAP_LEGEND = `Legenda: ^ > v < robô (para onde olha)   ${OBSTACLE_SYMBOL} obstáculo   ${FREE_SYMBOL} livre   ${UNKNOWN_SYMBOL} desconhecido`;

const keyOf = (x: number, y: number): string => `${String(x)},${String(y)}`;

// Norte para cima: a primeira linha é y = max. RN12: casa não explorada aparece como desconhecida.
export function formatMap({ min, max, explored, robot }: GridDTO): string {
  const known = new Map(
    explored.map((cell) => [keyOf(cell.x, cell.y), cell.blocked]),
  );
  const rows: string[] = [];
  for (let y = max; y >= min; y--) {
    const row: string[] = [];
    for (let x = min; x <= max; x++) {
      row.push(symbolAt(x, y));
    }
    rows.push(row.join(' '));
  }
  return rows.join('\n');

  function symbolAt(x: number, y: number): string {
    if (x === robot.x && y === robot.y) {
      return ROBOT_SYMBOLS[robot.orientation];
    }
    const blocked = known.get(keyOf(x, y));
    if (blocked === undefined) {
      return UNKNOWN_SYMBOL;
    }
    return blocked ? OBSTACLE_SYMBOL : FREE_SYMBOL;
  }
}

export function formatExploration({ min, max, explored }: GridDTO): string {
  const side = max - min + 1;
  return `Explorado: ${String(explored.length)} de ${String(side * side)} casas`;
}

// Mapa, quanto foi explorado e a legenda
export function formatMapView(grid: GridDTO): string {
  return [formatMap(grid), formatExploration(grid), MAP_LEGEND].join('\n');
}

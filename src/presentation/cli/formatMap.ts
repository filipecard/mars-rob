import type { MapDTO, OrientationDTO } from '../../application/dto.js';

const ROBOT_SYMBOLS: Record<OrientationDTO, string> = {
  N: '^',
  L: '>',
  S: 'v',
  O: '<',
};

export const OBSTACLE_SYMBOL = '#';
export const FREE_SYMBOL = '.';
export const UNKNOWN_SYMBOL = '?';

export function formatLegend({ robot }: MapDTO): string {
  return `Legenda: ^ > v < robô ${String(robot.id)} (para onde olha)   número outro robô   ${OBSTACLE_SYMBOL} obstáculo   ${FREE_SYMBOL} livre   ${UNKNOWN_SYMBOL} desconhecido`;
}

const keyOf = (x: number, y: number): string => `${String(x)},${String(y)}`;

// Norte para cima: a primeira linha é y = max. RN12: casa que o robô não conhece aparece como desconhecida.
// Os outros robôs aparecem pelo número do ID.
export function formatMap({
  min,
  max,
  explored,
  robot,
  others,
}: MapDTO): string {
  const known = new Map(
    explored.map((cell) => [keyOf(cell.x, cell.y), cell.blocked]),
  );
  const otherAt = new Map(
    others.map((other) => [keyOf(other.x, other.y), String(other.id)]),
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
    const other = otherAt.get(keyOf(x, y));
    if (other !== undefined) {
      return other;
    }
    const blocked = known.get(keyOf(x, y));
    if (blocked === undefined) {
      return UNKNOWN_SYMBOL;
    }
    return blocked ? OBSTACLE_SYMBOL : FREE_SYMBOL;
  }
}

export function formatExploration({ min, max, explored }: MapDTO): string {
  const side = max - min + 1;
  return `Explorado: ${String(explored.length)} de ${String(side * side)} casas`;
}

// Título, mapa, quanto foi explorado e a legenda
export function formatMapView(map: MapDTO): string {
  return [
    `Mapa do robô ${String(map.robot.id)}`,
    formatMap(map),
    formatExploration(map),
    formatLegend(map),
  ].join('\n');
}

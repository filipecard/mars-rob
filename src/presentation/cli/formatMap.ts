import type {
  CellDTO,
  GroundDTO,
  ItemDTO,
  MapDTO,
  OrientationDTO,
} from '../../application/dto.js';

const ROBOT_SYMBOLS: Record<OrientationDTO, string> = {
  N: '^',
  L: '>',
  S: 'v',
  O: '<',
};

export const OBSTACLE_SYMBOL = '#';
export const FREE_SYMBOL = '.';
export const UNKNOWN_SYMBOL = '?';

// RN23, RN26, RN27: o que há no chão (rocha continua sendo #)
const GROUND_SYMBOLS: Record<GroundDTO, string> = {
  free: FREE_SYMBOL,
  base: 'B',
  rock: OBSTACLE_SYMBOL,
  tree: 'T',
  ore: '$',
};

// RN25: itens no chão
const ITEM_SYMBOLS: Record<ItemDTO, string> = {
  branch: ',',
  stone: 'o',
  log: '=',
  iron: '%',
};

export function formatLegend({ robot }: MapDTO): string {
  return [
    `Legenda: ^ > v < robô ${String(robot.id)} (para onde olha)   número outro robô   ${UNKNOWN_SYMBOL} desconhecido   ${FREE_SYMBOL} livre`,
    `         B base   ${OBSTACLE_SYMBOL} rocha   T árvore   $ jazida   , galho   o pedra   = tronco   % ferro`,
  ].join('\n');
}

const keyOf = (x: number, y: number): string => `${String(x)},${String(y)}`;

// Norte para cima: a primeira linha é y = max. RN12: casa que o robô não conhece aparece
// como desconhecida; RN29: as outras aparecem como ele as viu da última vez.
// Os outros robôs aparecem pelo número do ID.
export function formatMap({
  min,
  max,
  explored,
  robot,
  others,
}: MapDTO): string {
  const known = new Map(explored.map((cell) => [keyOf(cell.x, cell.y), cell]));
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
    const cell = known.get(keyOf(x, y));
    return cell === undefined ? UNKNOWN_SYMBOL : cellSymbol(cell);
  }
}

// O item aparece por cima do chão livre; a base continua sendo B
function cellSymbol({ ground, item }: CellDTO): string {
  return ground === 'free' && item !== null
    ? ITEM_SYMBOLS[item]
    : GROUND_SYMBOLS[ground];
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

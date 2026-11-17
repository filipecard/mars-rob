import type { GridDTO, OrientationDTO } from '../../application/dto.js';

const ROBOT_SYMBOLS: Record<OrientationDTO, string> = {
  N: '^',
  L: '>',
  S: 'v',
  O: '<',
};

export const OBSTACLE_SYMBOL = '#';
export const FREE_SYMBOL = '.';

export const MAP_LEGEND = `Legenda: ^ > v < robô (para onde olha)   ${OBSTACLE_SYMBOL} obstáculo   ${FREE_SYMBOL} livre`;

// Norte para cima: a primeira linha é y = max
export function formatMap({ min, max, obstacles, robot }: GridDTO): string {
  const blocked = new Set(
    obstacles.flat().map(({ x, y }) => `${String(x)},${String(y)}`),
  );
  const rows: string[] = [];
  for (let y = max; y >= min; y--) {
    const row: string[] = [];
    for (let x = min; x <= max; x++) {
      if (x === robot.x && y === robot.y) {
        row.push(ROBOT_SYMBOLS[robot.orientation]);
      } else if (blocked.has(`${String(x)},${String(y)}`)) {
        row.push(OBSTACLE_SYMBOL);
      } else {
        row.push(FREE_SYMBOL);
      }
    }
    rows.push(row.join(' '));
  }
  return rows.join('\n');
}

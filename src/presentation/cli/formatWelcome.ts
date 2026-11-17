import type { GridDTO } from '../../application/dto.js';
import { formatMapView } from './formatMap.js';
import { EXIT_COMMAND, MAP_COMMAND } from './runCli.js';

export function formatWelcome(grid: GridDTO, seed: number): string {
  const count = grid.obstacleCount;
  const obstacles = count === 1 ? '1 obstáculo' : `${String(count)} obstáculos`;
  return [
    `Malha de ${String(grid.min)} a ${String(grid.max)} nos dois eixos, ${obstacles} (semente ${String(seed)}).`,
    formatMapView(grid),
    `Digite um comando (passos N, S, L, O; giros D, E), "${MAP_COMMAND}" para ver o mapa ou "${EXIT_COMMAND}" para encerrar.`,
  ].join('\n');
}

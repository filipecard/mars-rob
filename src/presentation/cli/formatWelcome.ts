import type { FleetDTO } from '../../application/dto.js';
import { EXIT_COMMAND, MAP_COMMAND, ROBOTS_COMMAND } from './runCli.js';

const plural = (count: number, one: string, many: string): string =>
  count === 1 ? `1 ${one}` : `${String(count)} ${many}`;

export function formatWelcome(fleet: FleetDTO, seed: number): string {
  const obstacles = plural(fleet.obstacleCount, 'obstáculo', 'obstáculos');
  const robots = plural(fleet.robots.length, 'robô', 'robôs');
  return [
    `Malha de ${String(fleet.min)} a ${String(fleet.max)} nos dois eixos, ${obstacles}, ${robots} (semente ${String(seed)}).`,
    'Ordens (várias na mesma linha, separadas por espaço):',
    '  ID:COMANDOS  move um robô (passos N, S, L, O; giros D, E), ex.: 1:NNDE',
    '  DE>PARA      envia o mapa de um robô para outro que está ao lado, ex.: 1>2',
    `"${MAP_COMMAND} ID" mostra o mapa de um robô, "${ROBOTS_COMMAND}" lista os robôs e "${EXIT_COMMAND}" encerra.`,
  ].join('\n');
}

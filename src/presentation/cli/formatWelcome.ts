import type { FleetDTO } from '../../application/dto.js';
import {
  EXIT_COMMAND,
  FORGET_COMMAND,
  LOAD_COMMAND,
  MAP_COMMAND,
  SAVE_COMMAND,
  SAVES_COMMAND,
  SCRIPT_COMMAND,
  SCRIPT_END,
  STATUS_COMMAND,
  STOP_COMMAND,
  TICKS_COMMAND,
  UPGRADE_COMMAND,
} from './runCli.js';

const plural = (count: number, one: string, many: string): string =>
  count === 1 ? `1 ${one}` : `${String(count)} ${many}`;

export function formatWelcome(fleet: FleetDTO, seed: number): string {
  const obstacles = plural(fleet.obstacleCount, 'obstáculo', 'obstáculos');
  const robots = plural(fleet.robotCount, 'robô', 'robôs');
  return [
    `Malha de ${String(fleet.min)} a ${String(fleet.max)} nos dois eixos, ${obstacles}, ${robots} (semente ${String(seed)}).`,
    'Ordens (várias na mesma linha, separadas por espaço; cada passo gasta 1 tick):',
    '  ID:COMANDOS  move um robô (passos N, S, L, O; giros D, E), ex.: 1:NNDE',
    '  DE>PARA      envia o mapa de um robô para outro que está ao lado, ex.: 1>2',
    'Comandos:',
    `  ${SCRIPT_COMMAND} ID    programa um robô; termine o script com uma linha "${SCRIPT_END}"`,
    `  ${TICKS_COMMAND} N      avança N ticks (o mundo anda mesmo sem robô rodando)`,
    `  ${STOP_COMMAND} ID     para o programa de um robô`,
    `  ${MAP_COMMAND} ID      mostra o mapa de um robô`,
    `  ${STATUS_COMMAND} ID    bateria, compartimento e melhorias do robô, e o armazém`,
    `  ${UPGRADE_COMMAND} ID M faz a melhoria M com o robô na base (picareta, machado, bateria, compartimento, visao, armazem)`,
    `  ${FORGET_COMMAND} ID    apaga o mapa de um robô`,
    `  ${SAVE_COMMAND} NOME   salva a simulação; ${LOAD_COMMAND} NOME carrega; ${SAVES_COMMAND} lista`,
    `  ${EXIT_COMMAND}         encerra`,
  ].join('\n');
}

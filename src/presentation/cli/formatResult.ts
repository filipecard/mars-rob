import type {
  EventDTO,
  ItemDTO,
  OrientationDTO,
  PositionDTO,
  RobotStateDTO,
  RobotStatusDTO,
  StorageDTO,
} from '../../application/dto.js';
import type { OrderResult } from '../../application/use-cases/ExecuteOrders.js';
import type { LoadScriptResult } from '../../application/use-cases/LoadScript.js';
import type {
  LoadResult,
  SaveResult,
} from '../../application/use-cases/SaveGame.js';
import type { UpgradeResult } from '../../application/use-cases/UpgradeRobot.js';
import {
  ACTION_NAMES,
  failText,
  ITEM_NAMES,
  itemList,
  UPGRADE_NAMES,
} from '../names.js';

const ORIENTATION_NAMES: Record<OrientationDTO, string> = {
  N: 'Norte',
  L: 'Leste',
  S: 'Sul',
  O: 'Oeste',
};

export function formatPosition({ x, y }: PositionDTO): string {
  return `(X: ${String(x)}, Y: ${String(y)})`;
}

const robotName = (id: number): string => `Robô ${String(id)}`;

export const unknownRobot = (id: number): string =>
  `Não existe robô com ID ${String(id)}`;

export function formatRobotState(robot: RobotStateDTO): string {
  return `${robotName(robot.id)}: posição atual ${formatPosition(robot)} para o ${ORIENTATION_NAMES[robot.orientation]}`;
}

function formatNewCells(count: number): string {
  if (count === 0) {
    return 'nenhuma casa nova';
  }
  return count === 1 ? '1 casa nova' : `${String(count)} casas novas`;
}

// Ordem aceita: não mostra nada (o resultado aparece depois de rodar os ticks)
export function formatOrderResult(result: OrderResult): string | null {
  if (result.ok) {
    return null;
  }
  switch (result.error) {
    case 'INVALID_ORDER':
      return `Ordem inválida "${result.input}": use ID:COMANDOS (ex.: 1:NNDE) ou DE>PARA (ex.: 1>2)`;
    case 'INVALID_COMMAND':
      return `Comando inválido em "${result.input}", permitido apenas as letras (N,S,L,O,D,E)`;
    case 'UNKNOWN_ROBOT':
      return unknownRobot(result.robotId);
  }
}

// Só o que interessa na CLI: bloqueios, compartilhamentos, coleta, falhas, print e
// erros. Passos, giros, esperas e recargas aparecem no estado final de cada robô.
export function formatEvent(event: EventDTO): string | null {
  const name = robotName(event.robot);
  switch (event.kind) {
    case 'moved':
    case 'turned':
    case 'waited':
    case 'recharged':
    case 'finished':
      return null;
    case 'collected':
      return `${name} pegou ${article(event.item)} ${ITEM_NAMES[event.item].one}`;
    case 'unloaded':
      return `${name} descarregou ${String(event.count)} ${event.count === 1 ? 'item' : 'itens'} no armazém`;
    case 'mined':
      return `${name} minerou ferro em ${formatPosition(event.at)}${event.depleted ? ' (a jazida acabou)' : ''}`;
    case 'upgraded':
      return `${name}: ${UPGRADE_NAMES[event.upgrade]} no nível ${String(event.level)}`;
    case 'failed':
      return `${name} não conseguiu ${ACTION_NAMES[event.action]}: ${failText(event.action, event.reason)}`;
    case 'blocked':
      return formatBlocked(event);
    case 'shared':
      return `${name} enviou o mapa para o robô ${String(event.to)}: ${formatNewCells(event.added)}`;
    case 'shareFailed':
      return formatShareFailed(event);
    case 'forgot':
      return `${name} apagou o mapa: ${formatForgotten(event.forgotten)}`;
    case 'printed':
      return `${name} diz: ${event.text}`;
    case 'error':
      return `${name}: erro no script na linha ${String(event.line)}, coluna ${String(event.column)}: ${event.message}`;
  }
}

export function formatForgotten(count: number): string {
  if (count === 0) {
    return 'nenhuma casa esquecida';
  }
  return count === 1 ? '1 casa esquecida' : `${String(count)} casas esquecidas`;
}

function formatBlocked(event: EventDTO & { kind: 'blocked' }): string {
  const name = robotName(event.robot);
  switch (event.reason) {
    case 'edge':
      return `${name}: não pode sair do limite da malha`;
    case 'obstacle':
      return `${name}: não pode passar pelo obstáculo em ${formatPosition(event.at)}`;
    case 'robot':
      return `${name}: não pode passar pelo robô ${String(event.other)} em ${formatPosition(event.at)}`;
  }
}

function formatShareFailed(event: EventDTO & { kind: 'shareFailed' }): string {
  switch (event.reason) {
    case 'notAdjacent':
      return `Os robôs ${String(event.robot)} e ${String(event.to)} precisam estar lado a lado para compartilhar o mapa`;
    case 'unknownRobot':
      return `${robotName(event.robot)}: ${unknownRobot(event.to)}`;
    case 'self':
      return `${robotName(event.robot)}: não pode enviar o mapa para si mesmo`;
  }
}

function article(item: ItemDTO): string {
  return item === 'stone' ? 'uma' : 'um';
}

// RN24, RN25, RN28: o estado de um robô e o armazém
export function formatStatus(
  robot: RobotStatusDTO,
  warehouse: StorageDTO,
): string {
  const levels = robot.upgrades
    .filter(({ level }) => level > 0)
    .map(({ upgrade, level }) => `${UPGRADE_NAMES[upgrade]} ${String(level)}`);
  return [
    formatRobotState(robot.map.robot) + (robot.atBase ? ' (na base)' : ''),
    `  Bateria: ${String(robot.battery)} de ${String(robot.maxBattery)}`,
    `  Compartimento (${String(robot.cargo.used)} de ${String(robot.cargo.capacity)}): ${itemList(robot.cargo.items)}`,
    `  Melhorias: ${levels.length === 0 ? 'nenhuma' : levels.join(', ')}`,
    `Armazém (${String(warehouse.used)} de ${String(warehouse.capacity)}): ${itemList(warehouse.items)}`,
  ].join('\n');
}

// RN28
export function formatUpgradeResult(result: UpgradeResult): string {
  if (result.ok) {
    return `${UPGRADE_NAMES[result.upgrade]} agora no nível ${String(result.level)}`;
  }
  switch (result.error) {
    case 'UNKNOWN_ROBOT':
      return unknownRobot(result.robotId);
    case 'UNKNOWN_UPGRADE':
      return `Melhoria desconhecida "${result.upgrade}": use picareta, bateria, compartimento, visao ou armazem`;
    case 'UPGRADE_FAILED': {
      const what = UPGRADE_NAMES[result.upgrade];
      if (result.reason === 'missing' && result.missing !== null) {
        return `Não deu para fazer ${what}: faltam ${itemList(result.missing)} no armazém`;
      }
      return `Não deu para fazer ${what}: ${failText('upgrade', result.reason)}`;
    }
  }
}

// RN30
export function formatSaveResult(result: SaveResult): string {
  return result.ok
    ? `Simulação salva como "${result.name}" (tick ${String(result.tick)})`
    : invalidSaveName(result.name);
}

export function formatLoadResult(result: LoadResult): string {
  if (result.ok) {
    return `Simulação "${result.name}" carregada (tick ${String(result.tick)}). Os scripts que estavam rodando recomeçaram.`;
  }
  switch (result.error) {
    case 'INVALID_NAME':
      return invalidSaveName(result.name);
    case 'NOT_FOUND':
      return `Não existe simulação salva com o nome "${result.name}"`;
    case 'INVALID_SAVE':
      return `O arquivo "${result.name}" não é uma simulação salva válida`;
  }
}

function invalidSaveName(name: string): string {
  return `Nome inválido "${name}": use letras sem acento, números, _ ou - (até 40)`;
}

export function formatLoadScriptResult(
  result: LoadScriptResult,
): string | null {
  if (result.ok) {
    return null;
  }
  return result.error === 'UNKNOWN_ROBOT'
    ? unknownRobot(result.robotId)
    : `Erro de sintaxe na linha ${String(result.line)}, coluna ${String(result.column)}: ${result.message}`;
}

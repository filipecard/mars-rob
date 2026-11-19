import type {
  EventDTO,
  OrientationDTO,
  PositionDTO,
  RobotStateDTO,
} from '../../application/dto.js';
import type { OrderResult } from '../../application/use-cases/ExecuteOrders.js';
import type { LoadScriptResult } from '../../application/use-cases/LoadScript.js';

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

// Só o que interessa na CLI: bloqueios, compartilhamentos, print e erros.
// Passos, giros e esperas aparecem no estado final de cada robô.
export function formatEvent(event: EventDTO): string | null {
  const name = robotName(event.robot);
  switch (event.kind) {
    case 'moved':
    case 'turned':
    case 'waited':
    case 'finished':
      return null;
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

import type {
  OrientationDTO,
  PositionDTO,
  RobotStateDTO,
} from '../../application/dto.js';
import type { OrderResult } from '../../application/use-cases/ExecuteOrders.js';

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

export function formatRobotState(robot: RobotStateDTO): string {
  return `${robotName(robot.id)}: posição atual ${formatPosition(robot)} para o ${ORIENTATION_NAMES[robot.orientation]}`;
}

function formatNewCells(count: number): string {
  if (count === 0) {
    return 'nenhuma casa nova';
  }
  return count === 1 ? '1 casa nova' : `${String(count)} casas novas`;
}

export function formatOrderResult(result: OrderResult): string {
  if (result.ok) {
    return result.kind === 'move'
      ? formatRobotState(result.robot)
      : `${robotName(result.from)} enviou o mapa para o robô ${String(result.to)}: ${formatNewCells(result.added)}`;
  }
  switch (result.error) {
    case 'INVALID_ORDER':
      return `Ordem inválida "${result.input}": use ID:COMANDOS (ex.: 1:NNDE) ou DE>PARA (ex.: 1>2)`;
    case 'INVALID_COMMAND':
      return `Comando inválido em "${result.input}", permitido apenas as letras (N,S,L,O,D,E)`;
    case 'UNKNOWN_ROBOT':
      return `Não existe robô com ID ${String(result.robotId)}`;
    case 'OUT_OF_GRID':
      return `${robotName(result.robot.id)}: não pode sair do limite da malha`;
    case 'OBSTACLE':
      return `${robotName(result.robot.id)}: não pode passar pelo obstáculo em ${formatPosition(result.obstacle)}`;
    case 'COLLISION':
      return `${robotName(result.robot.id)}: não pode passar pelo robô ${String(result.other)} em ${formatPosition(result.at)}`;
    case 'NOT_ADJACENT':
      return `Os robôs ${String(result.from)} e ${String(result.to)} precisam estar lado a lado para compartilhar o mapa`;
  }
}

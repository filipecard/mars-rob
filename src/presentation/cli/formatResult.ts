import type {
  MoveRobotError,
  MoveRobotResult,
  OrientationDTO,
  RobotStateDTO,
} from '../../application/use-cases/MoveRobot.js';

const ERROR_MESSAGES: Record<MoveRobotError, string> = {
  INVALID_COMMAND:
    'Tipo de entrada inválido, permitido apenas as letras (N,S,L,O,D,E)',
  OUT_OF_GRID: 'O robô não pode sair do limite da malha',
};

const ORIENTATION_NAMES: Record<OrientationDTO, string> = {
  N: 'Norte',
  L: 'Leste',
  S: 'Sul',
  O: 'Oeste',
};

export function formatRobotState({ x, y, orientation }: RobotStateDTO): string {
  return `Posição atual (X: ${String(x)}, Y: ${String(y)}) para o ${ORIENTATION_NAMES[orientation]}`;
}

export function formatResult(result: MoveRobotResult): string {
  if (result.ok) {
    return formatRobotState(result.robot);
  }
  return ERROR_MESSAGES[result.error];
}

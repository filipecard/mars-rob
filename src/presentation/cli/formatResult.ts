import type {
  OrientationDTO,
  PositionDTO,
  RobotStateDTO,
} from '../../application/dto.js';
import type { MoveRobotResult } from '../../application/use-cases/MoveRobot.js';

const INVALID_COMMAND_MESSAGE =
  'Tipo de entrada inválido, permitido apenas as letras (N,S,L,O,D,E)';
const OUT_OF_GRID_MESSAGE = 'O robô não pode sair do limite da malha';

const ORIENTATION_NAMES: Record<OrientationDTO, string> = {
  N: 'Norte',
  L: 'Leste',
  S: 'Sul',
  O: 'Oeste',
};

export function formatPosition({ x, y }: PositionDTO): string {
  return `(X: ${String(x)}, Y: ${String(y)})`;
}

export function formatRobotState(robot: RobotStateDTO): string {
  return `Posição atual ${formatPosition(robot)} para o ${ORIENTATION_NAMES[robot.orientation]}`;
}

export function formatResult(result: MoveRobotResult): string {
  if (result.ok) {
    return formatRobotState(result.robot);
  }
  switch (result.error) {
    case 'INVALID_COMMAND':
      return INVALID_COMMAND_MESSAGE;
    case 'OUT_OF_GRID':
      return OUT_OF_GRID_MESSAGE;
    case 'OBSTACLE':
      return `O robô não pode passar pelo obstáculo em ${formatPosition(result.obstacle)}`;
  }
}

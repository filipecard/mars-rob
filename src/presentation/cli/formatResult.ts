import type {
  MoveRobotError,
  MoveRobotResult,
  PositionDTO,
} from '../../application/use-cases/MoveRobot.js';

const ERROR_MESSAGES: Record<MoveRobotError, string> = {
  INVALID_COMMAND:
    'Tipo de entrada inválido, permitido apenas as letras (N,S,L,O)',
  OUT_OF_GRID: 'O robô não pode sair do limite da malha',
};

export function formatPosition({ x, y }: PositionDTO): string {
  return `Posição atual (X: ${String(x)}, Y: ${String(y)})`;
}

export function formatResult(result: MoveRobotResult): string {
  if (result.ok) {
    return formatPosition(result.position);
  }
  return ERROR_MESSAGES[result.error];
}

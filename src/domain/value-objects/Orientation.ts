import type { Direction } from './Direction.js';

// Sentido horário: girar e traduzir direções são deslocamentos de índice nesta lista
export const ORIENTATIONS = ['N', 'L', 'S', 'O'] as const;

export type Orientation = (typeof ORIENTATIONS)[number];

export const TURNS = ['D', 'E'] as const;

export type Turn = (typeof TURNS)[number];

function at(index: number): Orientation {
  const orientation = ORIENTATIONS[index % ORIENTATIONS.length];
  if (orientation === undefined) {
    throw new RangeError(`Índice de orientação inválido: ${String(index)}`);
  }
  return orientation;
}

// RN08
export function turnRight(orientation: Orientation): Orientation {
  return at(ORIENTATIONS.indexOf(orientation) + 1);
}

// RN08: voltar 1 casa num círculo de 4 é o mesmo que avançar 3 (evita módulo negativo)
export function turnLeft(orientation: Orientation): Orientation {
  return at(ORIENTATIONS.indexOf(orientation) + ORIENTATIONS.length - 1);
}

// RN08: cada giro tem sua ação; o Record obriga a registrar uma ação para cada Turn
const TURN_ACTIONS: Record<Turn, (orientation: Orientation) => Orientation> = {
  D: turnRight,
  E: turnLeft,
};

export function isTurn(value: string): value is Turn {
  return (TURNS as readonly string[]).includes(value);
}

export function turn(orientation: Orientation, direction: Turn): Orientation {
  return TURN_ACTIONS[direction](orientation);
}

// RN03: N/L/S/O relativos equivalem a girar 0°/90°/180°/270° a partir da orientação
export function toAbsolute(
  orientation: Orientation,
  relative: Direction,
): Direction {
  return at(ORIENTATIONS.indexOf(orientation) + ORIENTATIONS.indexOf(relative));
}

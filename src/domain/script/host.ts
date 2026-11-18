// O que o script pode pedir ao mundo. O interpretador não conhece a malha nem a frota:
// quem executa o script (a simulação) implementa RobotHost e aplica as ações.

// Ações: cada uma gasta 1 tick. O resultado (true/false) volta para o script.
export type Action =
  | {
      kind:
        | 'forward'
        | 'backward'
        | 'stepRight'
        | 'stepLeft'
        | 'turnRight'
        | 'turnLeft'
        | 'wait';
    }
  | { kind: 'shareMap'; to: number };

export type CellType = 'empty' | 'obstacle' | 'robot' | 'edge' | 'unknown';

export interface CellInfo {
  type: CellType;
  x: number;
  y: number;
  // ID do robô na casa, se houver
  robot: number | null;
}

export type Heading = 'north' | 'east' | 'south' | 'west';

export interface SelfInfo {
  id: number;
  x: number;
  y: number;
  orientation: Heading;
}

export type Side = 'front' | 'back' | 'left' | 'right';

// Sensores: não gastam tick
export interface RobotHost {
  self(): SelfInfo;
  // Casa vizinha, relativa à orientação do robô
  look(side: Side): CellInfo;
  // Casas da visão atual (3x3 em volta do robô)
  see(): CellInfo[];
  // Casa do mapa do próprio robô ("unknown" se ele ainda não viu)
  cellAt(x: number, y: number): CellInfo;
  // Quantas casas o robô conhece
  explored(): number;
  print(text: string): void;
}

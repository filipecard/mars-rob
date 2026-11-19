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
  | { kind: 'shareMap'; to: number }
  // RN20: apaga o mapa do próprio robô
  | { kind: 'forgetMap' };

// Os passos que não giram o robô (goTo anda só com eles)
export type StepKind = 'forward' | 'backward' | 'stepRight' | 'stepLeft';

export type CellType = 'empty' | 'obstacle' | 'robot' | 'edge' | 'unknown';

export interface CellInfo {
  type: CellType;
  x: number;
  y: number;
  // ID do robô na casa, se houver
  robot: number | null;
  // RN19: o robô já esteve nesta casa
  visited: boolean;
  // RN19: quantas casas desconhecidas há no 3x3 desta casa (o que o robô descobriria parando nela)
  unknownAround: number;
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
  // RN21: o menor caminho até (x, y) pelo mapa do robô, em passos sem giro.
  // [] se ele já está lá; null se não há caminho conhecido.
  pathTo(x: number, y: number): StepKind[] | null;
  print(text: string): void;
}

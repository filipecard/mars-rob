import type {
  Action,
  CellInfo,
  RobotHost,
  SelfInfo,
  Side,
  StepKind,
} from '../../../../src/domain/script/host.js';
import {
  ScriptProcess,
  type ProcessStep,
} from '../../../../src/domain/script/interpreter.js';

// Robô de mentira para testar a linguagem sem malha nem frota
export class FakeHost implements RobotHost {
  readonly printed: string[] = [];
  state: SelfInfo = { id: 1, x: 0, y: 0, orientation: 'north' };
  cells: Partial<Record<Side, CellInfo>> = {};
  visible: CellInfo[] = [];
  known = 9;
  path: StepKind[] | null = [];
  pathRequests: [number, number][] = [];

  self(): SelfInfo {
    return { ...this.state };
  }

  look(side: Side): CellInfo {
    return (
      this.cells[side] ?? {
        type: 'empty',
        x: 0,
        y: 1,
        robot: null,
        visited: false,
        unknownAround: 0,
      }
    );
  }

  see(): CellInfo[] {
    return this.visible;
  }

  cellAt(x: number, y: number): CellInfo {
    return {
      type: 'unknown',
      x,
      y,
      robot: null,
      visited: false,
      unknownAround: 0,
    };
  }

  explored(): number {
    return this.known;
  }

  pathTo(x: number, y: number): StepKind[] | null {
    this.pathRequests.push([x, y]);
    return this.path;
  }

  print(text: string): void {
    this.printed.push(text);
  }
}

export interface RunResult {
  actions: Action[];
  last: ProcessStep;
  host: FakeHost;
}

// Roda até terminar (ou até `maxSteps` ações), respondendo a cada ação com `answer`
export function runScript(
  source: string,
  {
    host = new FakeHost(),
    answer = () => true,
    maxSteps = 100,
  }: {
    host?: FakeHost;
    answer?: (action: Action, index: number) => boolean;
    maxSteps?: number;
  } = {},
): RunResult {
  const process = ScriptProcess.compile(source, host);
  const actions: Action[] = [];
  let result = true;
  for (;;) {
    const step = process.next(result);
    if (step.kind !== 'action' || actions.length >= maxSteps) {
      return { actions, last: step, host };
    }
    actions.push(step.action);
    result = answer(step.action, actions.length - 1);
  }
}

export const kinds = (actions: Action[]): string[] =>
  actions.map((action) => action.kind);

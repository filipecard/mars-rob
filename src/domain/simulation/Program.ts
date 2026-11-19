import type { Action } from '../script/host.js';
import type { ProcessStep } from '../script/interpreter.js';
import type { Command, Instruction } from '../value-objects/Command.js';

// RN17: o que um robô está executando. A cada tick a simulação pede o próximo passo
// e informa se a ação anterior deu certo.
export interface Program {
  readonly kind: 'orders' | 'script';
  next(lastActionSucceeded: boolean): ProcessStep;
}

// RN03/RN08: cada letra de um comando vira uma ação de 1 tick
const ACTIONS: Record<Instruction, Action> = {
  N: { kind: 'forward' },
  S: { kind: 'backward' },
  L: { kind: 'stepRight' },
  O: { kind: 'stepLeft' },
  D: { kind: 'turnRight' },
  E: { kind: 'turnLeft' },
};

export function actionsOf(command: Command): Action[] {
  return command.instructions.map((instruction) => ACTIONS[instruction]);
}

// RN17: as ordens diretas (ID:COMANDOS, DE>PARA) de um robô, 1 ação por tick.
// RN14: cada ordem é independente. Se uma ação falha, o resto daquela ordem é
// descartado e a próxima ordem do robô continua.
export class OrderProgram implements Program {
  readonly kind = 'orders';
  readonly #orders: (readonly Action[])[] = [];
  #order = 0;
  #step = 0;

  constructor(actions: readonly Action[] = []) {
    this.append(actions);
  }

  // Mais uma ordem, que roda depois das que já estão na fila
  append(actions: readonly Action[]): void {
    this.#orders.push([...actions]);
  }

  next(lastActionSucceeded: boolean): ProcessStep {
    if (!lastActionSucceeded) {
      this.#skipOrder();
    }
    for (;;) {
      const order = this.#orders[this.#order];
      if (order === undefined) {
        return { kind: 'finished' };
      }
      const action = order[this.#step];
      if (action !== undefined) {
        this.#step++;
        return { kind: 'action', action };
      }
      this.#skipOrder();
    }
  }

  #skipOrder(): void {
    this.#order++;
    this.#step = 0;
  }
}

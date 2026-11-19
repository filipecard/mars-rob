import { describe, expect, it } from 'vitest';
import type { Action } from '../../../../src/domain/script/host.js';
import type { ProcessStep } from '../../../../src/domain/script/interpreter.js';
import {
  actionsOf,
  OrderProgram,
} from '../../../../src/domain/simulation/Program.js';
import { Command } from '../../../../src/domain/value-objects/Command.js';

const kinds = (actions: Action[]): string[] => actions.map((a) => a.kind);

// Roda o programa respondendo a cada ação com `answer(índice)`
function drain(
  program: OrderProgram,
  answer: (index: number) => boolean = () => true,
): string[] {
  const done: string[] = [];
  let last = true;
  for (;;) {
    const step: ProcessStep = program.next(last);
    if (step.kind !== 'action') {
      return done;
    }
    done.push(step.action.kind);
    last = answer(done.length - 1);
  }
}

describe('actionsOf', () => {
  it('traduz cada letra numa ação de 1 tick — RN03, RN08', () => {
    expect(kinds(actionsOf(Command.parse('NSLODE')))).toEqual([
      'forward',
      'backward',
      'stepRight',
      'stepLeft',
      'turnRight',
      'turnLeft',
    ]);
  });
});

describe('OrderProgram', () => {
  it('entrega as ações na ordem e termina', () => {
    const program = new OrderProgram(actionsOf(Command.parse('ND')));

    expect(drain(program)).toEqual(['forward', 'turnRight']);
    expect(program.next(true)).toEqual({ kind: 'finished' });
  });

  it('ordens acrescentadas rodam depois das que já estão na fila', () => {
    const program = new OrderProgram(actionsOf(Command.parse('N')));
    program.append([{ kind: 'shareMap', to: 2 }]);

    expect(drain(program)).toEqual(['forward', 'shareMap']);
  });

  it('se uma ação falha, descarta o resto da ordem e segue para a próxima — RN14', () => {
    const program = new OrderProgram(actionsOf(Command.parse('NNN')));
    program.append(actionsOf(Command.parse('L')));

    expect(drain(program, (index) => index !== 1)).toEqual([
      'forward',
      'forward',
      'stepRight',
    ]);
  });

  it('falha na última ação de uma ordem não pula a próxima', () => {
    const program = new OrderProgram(actionsOf(Command.parse('N')));
    program.append(actionsOf(Command.parse('L')));

    expect(drain(program, (index) => index !== 0)).toEqual([
      'forward',
      'stepRight',
    ]);
  });

  it('ordens vazias são puladas', () => {
    const program = new OrderProgram([]);
    program.append([]);

    expect(program.next(true)).toEqual({ kind: 'finished' });
  });
});

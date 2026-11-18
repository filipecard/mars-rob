import type { SourceLocation } from './ScriptError.js';

// Árvore sintática (AST) produzida pelo parser e percorrida pelo interpretador

interface Node {
  location: SourceLocation;
}

export type BinaryOperator =
  '+' | '-' | '*' | '/' | '%' | '==' | '!=' | '<' | '<=' | '>' | '>=';

export type Expression =
  | (Node & { kind: 'number'; value: number })
  | (Node & { kind: 'string'; value: string })
  | (Node & { kind: 'boolean'; value: boolean })
  | (Node & { kind: 'null' })
  | (Node & { kind: 'identifier'; name: string })
  | (Node & { kind: 'list'; items: Expression[] })
  | (Node & { kind: 'unary'; operator: '!' | '-'; operand: Expression })
  | (Node & {
      kind: 'binary';
      operator: BinaryOperator;
      left: Expression;
      right: Expression;
    })
  | (Node & {
      kind: 'logical';
      operator: '&&' | '||';
      left: Expression;
      right: Expression;
    })
  | (Node & { kind: 'call'; callee: Expression; args: Expression[] })
  | (Node & { kind: 'member'; object: Expression; property: string })
  | (Node & { kind: 'index'; object: Expression; index: Expression });

// O que pode ficar à esquerda de "=": variável, propriedade ou posição de lista
export type AssignTarget = Extract<
  Expression,
  { kind: 'identifier' | 'member' | 'index' }
>;

export type AssignOperator = '=' | '+=' | '-=' | '*=' | '/=';

export type Statement =
  | (Node & { kind: 'let'; name: string; init: Expression | null })
  | (Node & {
      kind: 'assign';
      target: AssignTarget;
      operator: AssignOperator;
      value: Expression;
    })
  | (Node & { kind: 'update'; target: AssignTarget; operator: '++' | '--' })
  | (Node & { kind: 'expression'; expression: Expression })
  | (Node & { kind: 'block'; body: Statement[] })
  | (Node & {
      kind: 'if';
      condition: Expression;
      then: Statement;
      otherwise: Statement | null;
    })
  | (Node & { kind: 'while'; condition: Expression; body: Statement })
  | (Node & {
      kind: 'for';
      init: Statement | null;
      condition: Expression | null;
      update: Statement | null;
      body: Statement;
    })
  | (Node & {
      kind: 'forOf';
      name: string;
      iterable: Expression;
      body: Statement;
    })
  | (Node & {
      kind: 'function';
      name: string;
      params: string[];
      body: Statement[];
    })
  | (Node & { kind: 'return'; value: Expression | null })
  | (Node & { kind: 'break' })
  | (Node & { kind: 'continue' });

export interface Program {
  body: Statement[];
}

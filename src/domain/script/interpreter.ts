import type {
  AssignTarget,
  BinaryOperator,
  Expression,
  Program,
  Statement,
} from './ast.js';
import {
  builtinScope,
  integer,
  number,
  selfRecord,
  StopSignal,
} from './builtins.js';
import type { Action, RobotHost } from './host.js';
import { parse } from './parser.js';
import { ScriptRuntimeError, type SourceLocation } from './ScriptError.js';
import { didYouMean } from './suggest.js';
import {
  equals,
  isTruthy,
  Scope,
  toText,
  typeName,
  type Execution,
  type FunctionValue,
  type ListValue,
  type NativeValue,
  type ObjectValue,
  type Value,
} from './values.js';

// Limite de operações entre duas ações: impede que um loop sem ação trave o tick
export const MAX_OPERATIONS = 10_000;
export const MAX_CALL_DEPTH = 200;

// Nome reservado: sempre o estado atual do robô
const SELF = 'self';
// Onde o método guarda o objeto ("this" é palavra reservada: o script não declara)
const THIS = 'this';
const CONSTRUCTOR = 'constructor';

type Completion =
  | { type: 'normal' }
  | { type: 'break' }
  | { type: 'continue' }
  | { type: 'return'; value: Value };

const NORMAL: Completion = { type: 'normal' };

export type ProcessStep =
  | { kind: 'action'; action: Action }
  | { kind: 'finished' }
  | { kind: 'error'; error: ScriptRuntimeError };

// Um script em execução. A cada tick, a simulação chama next(): o script roda até
// pedir uma ação (e pausa ali), terminar ou dar erro. O resultado da ação
// (true se deu certo) entra na próxima chamada de next().
export class ScriptProcess {
  readonly #interpreter: Interpreter;
  readonly #execution: Generator<Action, void, boolean>;
  #finished = false;

  private constructor(program: Program, host: RobotHost) {
    this.#interpreter = new Interpreter(host);
    this.#execution = this.#interpreter.run(program);
  }

  // Erro de sintaxe: ScriptSyntaxError, antes de começar
  static compile(source: string, host: RobotHost): ScriptProcess {
    return new ScriptProcess(parse(source), host);
  }

  get finished(): boolean {
    return this.#finished;
  }

  next(lastActionSucceeded = true): ProcessStep {
    if (this.#finished) {
      return { kind: 'finished' };
    }
    this.#interpreter.resetOperations();
    try {
      const step = this.#execution.next(lastActionSucceeded);
      if (step.done === true) {
        this.#finished = true;
        return { kind: 'finished' };
      }
      return { kind: 'action', action: step.value };
    } catch (error) {
      this.#finished = true;
      if (error instanceof StopSignal) {
        return { kind: 'finished' };
      }
      if (error instanceof ScriptRuntimeError) {
        return { kind: 'error', error };
      }
      if (error instanceof RangeError) {
        // Pilha do JavaScript estourou (recursão profunda demais)
        return {
          kind: 'error',
          error: new ScriptRuntimeError('recursão profunda demais', {
            line: 1,
            column: 1,
          }),
        };
      }
      throw error;
    }
  }
}

class Interpreter {
  readonly #host: RobotHost;
  readonly #builtins: Scope;
  #operations = 0;
  #depth = 0;

  constructor(host: RobotHost) {
    this.#host = host;
    this.#builtins = builtinScope(host);
  }

  resetOperations(): void {
    this.#operations = 0;
  }

  *run(program: Program): Generator<Action, void, boolean> {
    yield* this.#block(program.body, new Scope(this.#builtins));
  }

  #count(location: SourceLocation): void {
    this.#operations++;
    if (this.#operations > MAX_OPERATIONS) {
      throw new ScriptRuntimeError(
        `mais de ${String(MAX_OPERATIONS)} operações sem nenhuma ação (loop infinito?)`,
        location,
      );
    }
  }

  // --- comandos

  // Funções e classes podem ser usadas antes da linha em que foram declaradas (hoisting)
  *#block(body: Statement[], scope: Scope): Execution<Completion> {
    for (const statement of body) {
      if (statement.kind === 'function') {
        this.#declare(scope, statement.name, statement.location, {
          kind: 'function',
          name: statement.name,
          params: statement.params,
          body: statement.body,
          closure: scope,
        });
      } else if (statement.kind === 'class') {
        this.#declare(scope, statement.name, statement.location, {
          kind: 'class',
          name: statement.name,
          methods: new Map(
            statement.methods.map((method) => [method.name, method]),
          ),
          closure: scope,
        });
      }
    }
    for (const statement of body) {
      if (statement.kind === 'function' || statement.kind === 'class') {
        continue;
      }
      const completion = yield* this.#statement(statement, scope);
      if (completion.type !== 'normal') {
        return completion;
      }
    }
    return NORMAL;
  }

  *#statement(statement: Statement, scope: Scope): Execution<Completion> {
    this.#count(statement.location);
    switch (statement.kind) {
      case 'let': {
        const value =
          statement.init === null
            ? null
            : yield* this.#expression(statement.init, scope);
        this.#declare(scope, statement.name, statement.location, value);
        return NORMAL;
      }
      case 'assign': {
        const value = yield* this.#expression(statement.value, scope);
        if (statement.operator === '=') {
          yield* this.#assign(statement.target, value, scope);
          return NORMAL;
        }
        const current = yield* this.#expression(statement.target, scope);
        const operator = statement.operator.slice(0, 1) as BinaryOperator;
        const result = binary(operator, current, value, statement.location);
        yield* this.#assign(statement.target, result, scope);
        return NORMAL;
      }
      case 'update': {
        const current = yield* this.#expression(statement.target, scope);
        const delta = statement.operator === '++' ? 1 : -1;
        const result = number(current, statement.location) + delta;
        yield* this.#assign(statement.target, result, scope);
        return NORMAL;
      }
      case 'expression':
        yield* this.#expression(statement.expression, scope);
        return NORMAL;
      case 'block':
        return yield* this.#block(statement.body, new Scope(scope));
      case 'if': {
        const condition = yield* this.#expression(statement.condition, scope);
        if (isTruthy(condition)) {
          return yield* this.#statement(statement.then, scope);
        }
        return statement.otherwise === null
          ? NORMAL
          : yield* this.#statement(statement.otherwise, scope);
      }
      case 'while':
        while (isTruthy(yield* this.#expression(statement.condition, scope))) {
          const completion = yield* this.#statement(statement.body, scope);
          if (completion.type === 'break') {
            break;
          }
          if (completion.type === 'return') {
            return completion;
          }
        }
        return NORMAL;
      case 'for':
        return yield* this.#for(statement, new Scope(scope));
      case 'forOf':
        return yield* this.#forOf(statement, scope);
      case 'function':
      case 'class':
        // Já declarada no início do bloco
        return NORMAL;
      case 'return':
        return {
          type: 'return',
          value:
            statement.value === null
              ? null
              : yield* this.#expression(statement.value, scope),
        };
      case 'break':
        return { type: 'break' };
      case 'continue':
        return { type: 'continue' };
    }
  }

  *#for(
    statement: Statement & { kind: 'for' },
    scope: Scope,
  ): Execution<Completion> {
    if (statement.init !== null) {
      yield* this.#statement(statement.init, scope);
    }
    for (;;) {
      if (statement.condition !== null) {
        const condition = yield* this.#expression(statement.condition, scope);
        if (!isTruthy(condition)) {
          return NORMAL;
        }
      }
      const completion = yield* this.#statement(statement.body, scope);
      if (completion.type === 'break') {
        return NORMAL;
      }
      if (completion.type === 'return') {
        return completion;
      }
      if (statement.update !== null) {
        yield* this.#statement(statement.update, scope);
      }
    }
  }

  *#forOf(
    statement: Statement & { kind: 'forOf' },
    scope: Scope,
  ): Execution<Completion> {
    const iterable = yield* this.#expression(statement.iterable, scope);
    let items: Value[];
    if (typeof iterable === 'string') {
      items = Array.from(iterable);
    } else if (isList(iterable)) {
      // Cópia: mexer na lista dentro do loop não muda as voltas
      items = [...iterable.items];
    } else {
      throw new ScriptRuntimeError(
        `"for of" precisa de uma lista ou texto, recebeu ${typeName(iterable)}`,
        statement.location,
      );
    }
    for (const item of items) {
      const inner = new Scope(scope);
      this.#declare(inner, statement.name, statement.location, item);
      const completion = yield* this.#statement(statement.body, inner);
      if (completion.type === 'break') {
        break;
      }
      if (completion.type === 'return') {
        return completion;
      }
    }
    return NORMAL;
  }

  #declare(
    scope: Scope,
    name: string,
    location: SourceLocation,
    value: Value,
  ): void {
    if (name === SELF) {
      throw new ScriptRuntimeError('"self" é reservado', location);
    }
    if (scope.has(name)) {
      throw new ScriptRuntimeError(
        `"${name}" já foi declarado neste bloco`,
        location,
      );
    }
    scope.declare(name, value);
  }

  *#assign(target: AssignTarget, value: Value, scope: Scope): Execution<void> {
    const { location } = target;
    switch (target.kind) {
      case 'identifier': {
        const owner = scope.owner(target.name);
        if (target.name === SELF || owner?.locked === true) {
          throw new ScriptRuntimeError(
            `"${target.name}" faz parte da linguagem e não pode ser alterado`,
            location,
          );
        }
        if (owner === undefined) {
          throw new ScriptRuntimeError(
            `"${target.name}" não foi declarado (use let ${target.name} = ...)`,
            location,
          );
        }
        owner.set(target.name, value);
        return;
      }
      case 'member': {
        const object = yield* this.#expression(target.object, scope);
        if (isObject(object)) {
          object.fields.set(target.property, value);
          return;
        }
        throw new ScriptRuntimeError(
          isList(object) || typeof object !== 'object' || object === null
            ? `não dá para criar a propriedade "${target.property}" em ${typeName(object)}`
            : `a propriedade "${target.property}" é só de leitura`,
          location,
        );
      }
      case 'index': {
        const list = yield* this.#expression(target.object, scope);
        const index = integer(
          yield* this.#expression(target.index, scope),
          location,
        );
        if (!isList(list)) {
          throw new ScriptRuntimeError(
            `só dá para alterar posições de uma lista, não de ${typeName(list)}`,
            location,
          );
        }
        if (index < 0 || index > list.items.length) {
          throw new ScriptRuntimeError(
            `posição ${String(index)} fora da lista (tamanho ${String(list.items.length)})`,
            location,
          );
        }
        list.items[index] = value;
        return;
      }
    }
  }

  // --- expressões

  *#expression(expression: Expression, scope: Scope): Execution {
    const { location } = expression;
    switch (expression.kind) {
      case 'number':
      case 'string':
      case 'boolean':
        return expression.value;
      case 'null':
        return null;
      case 'this':
        // O parser só aceita "this" dentro de métodos
        return scope.owner(THIS)?.get(THIS) ?? null;
      case 'new':
        return yield* this.#new(expression, scope);
      case 'identifier':
        return this.#lookup(expression.name, scope, location);
      case 'list': {
        const items: Value[] = [];
        for (const item of expression.items) {
          items.push(yield* this.#expression(item, scope));
        }
        return { kind: 'list', items };
      }
      case 'unary': {
        const operand = yield* this.#expression(expression.operand, scope);
        return expression.operator === '!'
          ? !isTruthy(operand)
          : -number(operand, location);
      }
      case 'binary': {
        const left = yield* this.#expression(expression.left, scope);
        const right = yield* this.#expression(expression.right, scope);
        return binary(expression.operator, left, right, location);
      }
      case 'logical': {
        // Curto-circuito: o lado direito só roda se precisar
        const left = yield* this.#expression(expression.left, scope);
        if (expression.operator === '&&' ? !isTruthy(left) : isTruthy(left)) {
          return left;
        }
        return yield* this.#expression(expression.right, scope);
      }
      case 'call':
        return yield* this.#call(expression, scope);
      case 'member': {
        const object = yield* this.#expression(expression.object, scope);
        return member(object, expression.property, location);
      }
      case 'index': {
        const object = yield* this.#expression(expression.object, scope);
        const index = integer(
          yield* this.#expression(expression.index, scope),
          location,
        );
        if (isList(object)) {
          return object.items[index] ?? null;
        }
        if (typeof object === 'string') {
          return object[index] ?? null;
        }
        throw new ScriptRuntimeError(
          `não dá para usar [ ] em ${typeName(object)}`,
          location,
        );
      }
    }
  }

  #lookup(name: string, scope: Scope, location: SourceLocation): Value {
    if (name === SELF) {
      return selfRecord(this.#host.self());
    }
    const owner = scope.owner(name);
    if (owner === undefined) {
      throw new ScriptRuntimeError(
        `"${name}" não foi declarado${didYouMean(name, [SELF, ...scope.names()])}`,
        location,
      );
    }
    return owner.get(name);
  }

  *#new(expression: Expression & { kind: 'new' }, scope: Scope): Execution {
    const { location } = expression;
    this.#count(location);
    const callee = yield* this.#expression(expression.callee, scope);
    if (
      callee === null ||
      typeof callee !== 'object' ||
      callee.kind !== 'class'
    ) {
      throw new ScriptRuntimeError(
        `"new" precisa de uma classe, recebeu ${typeName(callee)}`,
        location,
      );
    }
    const args: Value[] = [];
    for (const arg of expression.args) {
      args.push(yield* this.#expression(arg, scope));
    }
    const object: ObjectValue = {
      kind: 'object',
      class: callee,
      fields: new Map(),
    };
    const constructor = bindMethod(object, CONSTRUCTOR);
    if (constructor !== undefined) {
      yield* this.#callFunction(constructor, args, location);
    } else if (args.length > 0) {
      throw new ScriptRuntimeError(
        `${callee.name} não tem constructor, então não recebe argumentos`,
        location,
      );
    }
    return object;
  }

  *#call(expression: Expression & { kind: 'call' }, scope: Scope): Execution {
    const { location } = expression;
    this.#count(location);
    const callee = yield* this.#expression(expression.callee, scope);
    const args: Value[] = [];
    for (const arg of expression.args) {
      args.push(yield* this.#expression(arg, scope));
    }
    if (!isCallable(callee)) {
      throw new ScriptRuntimeError(
        notCallable(expression.callee, callee),
        location,
      );
    }
    if (callee.kind === 'native') {
      checkArity(callee, args.length, location);
      return yield* callee.call(args, location);
    }
    return yield* this.#callFunction(callee, args, location);
  }

  *#callFunction(
    fn: FunctionValue,
    args: Value[],
    location: SourceLocation,
  ): Execution {
    if (args.length !== fn.params.length) {
      throw new ScriptRuntimeError(
        `${fn.name} espera ${String(fn.params.length)} argumento(s), recebeu ${String(args.length)}`,
        location,
      );
    }
    if (this.#depth >= MAX_CALL_DEPTH) {
      throw new ScriptRuntimeError(
        `recursão profunda demais (mais de ${String(MAX_CALL_DEPTH)} chamadas)`,
        location,
      );
    }
    const scope = new Scope(fn.closure);
    if (fn.receiver !== undefined) {
      scope.declare(THIS, fn.receiver);
    }
    fn.params.forEach((param, i) => {
      scope.declare(param, args[i] ?? null);
    });
    this.#depth++;
    try {
      const completion = yield* this.#block(fn.body, scope);
      return completion.type === 'return' ? completion.value : null;
    } finally {
      this.#depth--;
    }
  }
}

function isList(value: Value): value is ListValue {
  return value !== null && typeof value === 'object' && value.kind === 'list';
}

function isObject(value: Value): value is ObjectValue {
  return value !== null && typeof value === 'object' && value.kind === 'object';
}

// O método da classe ligado ao objeto (dentro dele, "this" é o objeto)
function bindMethod(
  object: ObjectValue,
  name: string,
): FunctionValue | undefined {
  const method = object.class.methods.get(name);
  if (method === undefined) {
    return undefined;
  }
  return {
    kind: 'function',
    name: `${object.class.name}.${name}`,
    params: method.params,
    body: method.body,
    closure: object.class.closure,
    receiver: object,
  };
}

// Mensagem para quem tentou chamar algo que não é função
function notCallable(callee: Expression, value: Value): string {
  if (value !== null && typeof value === 'object' && value.kind === 'class') {
    return `para criar um ${value.name}, use new ${value.name}(...)`;
  }
  if (callee.kind === 'member') {
    return `"${callee.property}" é um campo, não uma função: use ${source(callee)}, sem os parênteses`;
  }
  if (callee.kind === 'identifier') {
    return `"${callee.name}" não é uma função (é ${typeName(value)})`;
  }
  return `${typeName(value)} não é uma função`;
}

// Um trecho do script reescrito a partir da árvore, para as mensagens de erro
function source(expression: Expression): string {
  switch (expression.kind) {
    case 'identifier':
      return expression.name;
    case 'this':
      return 'this';
    case 'member':
      return `${source(expression.object)}.${expression.property}`;
    case 'call':
      return `${source(expression.callee)}(${expression.args.length > 0 ? '...' : ''})`;
    case 'index':
      return `${source(expression.object)}[...]`;
    default:
      return '...';
  }
}

function isCallable(value: Value): value is FunctionValue | NativeValue {
  return (
    value !== null &&
    typeof value === 'object' &&
    (value.kind === 'function' || value.kind === 'native')
  );
}

function checkArity(
  fn: NativeValue,
  count: number,
  location: SourceLocation,
): void {
  if (count < fn.minArgs || count > fn.maxArgs) {
    const expected =
      fn.minArgs === fn.maxArgs
        ? String(fn.minArgs)
        : fn.maxArgs === Infinity
          ? `pelo menos ${String(fn.minArgs)}`
          : `de ${String(fn.minArgs)} a ${String(fn.maxArgs)}`;
    throw new ScriptRuntimeError(
      `${fn.name} espera ${expected} argumento(s), recebeu ${String(count)}`,
      location,
    );
  }
}

function binary(
  operator: BinaryOperator,
  left: Value,
  right: Value,
  location: SourceLocation,
): Value {
  switch (operator) {
    case '==':
      return equals(left, right);
    case '!=':
      return !equals(left, right);
    case '+':
      if (typeof left === 'number' && typeof right === 'number') {
        return left + right;
      }
      if (typeof left === 'string' || typeof right === 'string') {
        return toText(left) + toText(right);
      }
      throw new ScriptRuntimeError(
        `"+" precisa de números ou textos, recebeu ${typeName(left)} e ${typeName(right)}`,
        location,
      );
    case '<':
    case '<=':
    case '>':
    case '>=':
      return compare(operator, left, right, location);
    case '-':
    case '*':
    case '/':
    case '%':
      return arithmetic(operator, left, right, location);
  }
}

function arithmetic(
  operator: '-' | '*' | '/' | '%',
  left: Value,
  right: Value,
  location: SourceLocation,
): number {
  const a = number(left, location);
  const b = number(right, location);
  if ((operator === '/' || operator === '%') && b === 0) {
    throw new ScriptRuntimeError('divisão por zero', location);
  }
  switch (operator) {
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return a / b;
    case '%':
      return a % b;
  }
}

function compare(
  operator: '<' | '<=' | '>' | '>=',
  left: Value,
  right: Value,
  location: SourceLocation,
): boolean {
  if (typeof left === 'number' && typeof right === 'number') {
    return order(operator, left, right);
  }
  if (typeof left === 'string' && typeof right === 'string') {
    return order(operator, left, right);
  }
  throw new ScriptRuntimeError(
    `"${operator}" compara dois números ou dois textos, recebeu ${typeName(left)} e ${typeName(right)}`,
    location,
  );
}

function order<T extends number | string>(
  operator: '<' | '<=' | '>' | '>=',
  a: T,
  b: T,
): boolean {
  switch (operator) {
    case '<':
      return a < b;
    case '<=':
      return a <= b;
    case '>':
      return a > b;
    case '>=':
      return a >= b;
  }
}

// Propriedades de objetos nativos, listas e textos
function member(
  object: Value,
  property: string,
  location: SourceLocation,
): Value {
  if (typeof object === 'string' && property === 'length') {
    return object.length;
  }
  if (object !== null && typeof object === 'object') {
    if (object.kind === 'record') {
      const value = object.fields.get(property);
      if (value !== undefined) {
        return value;
      }
    }
    if (object.kind === 'object') {
      const value =
        object.fields.get(property) ??
        (property === CONSTRUCTOR ? undefined : bindMethod(object, property));
      if (value !== undefined) {
        return value;
      }
    }
    if (object.kind === 'list') {
      const listMember = listMethod(object, property);
      if (listMember !== undefined) {
        return listMember;
      }
    }
  }
  throw new ScriptRuntimeError(
    `${typeName(object)} não tem a propriedade "${property}"${didYouMean(property, propertiesOf(object))}`,
    location,
  );
}

const LIST_PROPERTIES = ['length', 'push', 'pop', 'shift', 'includes'];

function propertiesOf(object: Value): string[] {
  if (object === null || typeof object !== 'object') {
    return typeof object === 'string' ? ['length'] : [];
  }
  switch (object.kind) {
    case 'record':
      return [...object.fields.keys()];
    case 'object':
      return [
        ...object.fields.keys(),
        ...[...object.class.methods.keys()].filter((m) => m !== CONSTRUCTOR),
      ];
    case 'list':
      return LIST_PROPERTIES;
    default:
      return [];
  }
}

function listMethod(list: ListValue, property: string): Value | undefined {
  const method = (
    name: string,
    minArgs: number,
    maxArgs: number,
    run: (args: Value[]) => Value,
  ): NativeValue => ({
    kind: 'native',
    name,
    minArgs,
    maxArgs,
    // eslint-disable-next-line require-yield -- métodos de lista não pausam
    *call(args) {
      return run(args);
    },
  });
  switch (property) {
    case 'length':
      return list.items.length;
    case 'push':
      return method('push', 1, Infinity, (args) => list.items.push(...args));
    case 'pop':
      return method('pop', 0, 0, () => list.items.pop() ?? null);
    case 'shift':
      return method('shift', 0, 0, () => list.items.shift() ?? null);
    case 'includes':
      return method('includes', 1, 1, ([value]) =>
        list.items.some((item) => equals(item, value ?? null)),
      );
    default:
      return undefined;
  }
}

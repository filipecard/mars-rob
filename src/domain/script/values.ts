import type { Statement } from './ast.js';
import type { Action } from './host.js';
import type { SourceLocation } from './ScriptError.js';

// Valores que existem enquanto o script roda

export interface ListValue {
  kind: 'list';
  items: Value[];
}

// Objetos nativos, só de leitura: casa, posição e o próprio robô (self)
export type RecordType = 'cell' | 'position' | 'robot';

export interface RecordValue {
  kind: 'record';
  type: RecordType;
  fields: ReadonlyMap<string, Value>;
}

export interface FunctionValue {
  kind: 'function';
  name: string;
  params: string[];
  body: Statement[];
  closure: Scope;
}

// Execução que pode pausar: entrega ações (yield), recebe se deram certo e devolve um valor
export type Execution<T = Value> = Generator<Action, T, boolean>;

export interface NativeValue {
  kind: 'native';
  name: string;
  minArgs: number;
  // Infinity: aceita quantos argumentos vierem
  maxArgs: number;
  call(args: Value[], location: SourceLocation): Execution;
}

export type Value =
  | number
  | string
  | boolean
  | null
  | ListValue
  | RecordValue
  | FunctionValue
  | NativeValue;

// Escopo léxico: cada bloco e cada chamada de função tem o seu
export class Scope {
  readonly #variables = new Map<string, Value>();
  readonly parent: Scope | null;
  // O escopo das funções nativas não pode ser alterado pelo script
  readonly locked: boolean;

  constructor(parent: Scope | null, locked = false) {
    this.parent = parent;
    this.locked = locked;
  }

  has(name: string): boolean {
    return this.#variables.has(name);
  }

  declare(name: string, value: Value): void {
    this.#variables.set(name, value);
  }

  // O escopo mais próximo que tem a variável
  owner(name: string): Scope | undefined {
    return this.has(name) ? this : this.parent?.owner(name);
  }

  get(name: string): Value {
    return this.#variables.get(name) ?? null;
  }

  set(name: string, value: Value): void {
    this.#variables.set(name, value);
  }
}

export function record(
  type: RecordType,
  fields: Record<string, Value>,
): RecordValue {
  return { kind: 'record', type, fields: new Map(Object.entries(fields)) };
}

export function isTruthy(value: Value): boolean {
  return !(value === false || value === null || value === 0 || value === '');
}

// Nome do tipo, usado por type() e nas mensagens de erro.
// Para uma casa, type() devolve o conteúdo dela; aqui é sempre "cell".
export function typeName(value: Value): string {
  if (value === null) {
    return 'null';
  }
  switch (typeof value) {
    case 'number':
      return 'number';
    case 'string':
      return 'string';
    case 'boolean':
      return 'boolean';
    default:
      break;
  }
  switch (value.kind) {
    case 'list':
      return 'list';
    case 'record':
      return value.type;
    case 'function':
    case 'native':
      return 'function';
  }
}

// Primitivos comparam pelo valor; listas, objetos e funções pela identidade
export function equals(a: Value, b: Value): boolean {
  return a === b;
}

export function toText(value: Value): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value !== 'object') {
    return String(value);
  }
  switch (value.kind) {
    case 'list':
      return `[${value.items.map(toText).join(', ')}]`;
    case 'record':
      return recordText(value);
    case 'function':
    case 'native':
      return `function ${value.name}`;
  }
}

function recordText({ type, fields }: RecordValue): string {
  if (type === 'position') {
    return `(${toText(fields.get('x') ?? null)}, ${toText(fields.get('y') ?? null)})`;
  }
  if (type === 'robot') {
    return `robot ${toText(fields.get('id') ?? null)}`;
  }
  return `${toText(fields.get('type') ?? null)} ${toText(fields.get('position') ?? null)}`;
}

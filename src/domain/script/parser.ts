import type {
  AssignOperator,
  AssignTarget,
  BinaryOperator,
  Expression,
  MethodDeclaration,
  Program,
  Statement,
} from './ast.js';
import { tokenize, type Keyword, type Token } from './lexer.js';
import { ScriptSyntaxError, type SourceLocation } from './ScriptError.js';

const ASSIGN_OPERATORS: readonly string[] = ['=', '+=', '-=', '*=', '/='];

// Operadores escritos por extenso, comuns em outras linguagens
const WORD_OPERATORS: Readonly<Record<string, string>> = {
  and: '&&',
  or: '||',
};

// Precedência, da mais fraca para a mais forte (|| e && ficam à parte: são lógicos)
const BINARY_LEVELS: readonly (readonly BinaryOperator[])[] = [
  ['==', '!='],
  ['<', '<=', '>', '>='],
  ['+', '-'],
  ['*', '/', '%'],
];

// Descida recursiva: cada nível da gramática é um método.
// O ponto e vírgula é opcional no fim dos comandos.
export function parse(source: string): Program {
  return new Parser(tokenize(source)).program();
}

class Parser {
  readonly #tokens: Token[];
  #position = 0;
  // Para validar return/break/continue fora de lugar
  #functionDepth = 0;
  #loopDepth = 0;
  // Dentro dos métodos de uma classe, "this" é o objeto
  #methodDepth = 0;

  constructor(tokens: Token[]) {
    this.#tokens = tokens;
  }

  program(): Program {
    const body: Statement[] = [];
    while (this.#peek().kind !== 'end') {
      body.push(this.#statement());
    }
    return { body };
  }

  // --- comandos

  #statement(): Statement {
    const token = this.#peek();
    if (token.kind === 'keyword') {
      switch (token.value) {
        case 'let':
          return this.#endSimple(this.#let());
        case 'if':
          return this.#if();
        case 'while':
          return this.#while();
        case 'for':
          return this.#for();
        case 'function':
          return this.#function();
        case 'class':
          return this.#class();
        case 'return':
          return this.#return();
        case 'break':
        case 'continue':
          return this.#jump(token.value);
        default:
          break;
      }
    }
    if (this.#isPunctuation('{')) {
      return this.#block();
    }
    if (
      token.kind === 'identifier' &&
      (token.value === 'var' || token.value === 'const') &&
      this.#peek(1).kind === 'identifier'
    ) {
      throw this.#error(
        `use "let" para declarar variáveis (não existe "${token.value}")`,
        token.location,
      );
    }
    return this.#endSimple(this.#simple());
  }

  #endSimple(statement: Statement): Statement {
    this.#rejectWordOperator();
    this.#matchPunctuation(';');
    return statement;
  }

  // "a and b" seria lido como três comandos soltos: avisa antes
  #rejectWordOperator(): void {
    const token = this.#peek();
    if (token.kind === 'identifier') {
      const symbol = WORD_OPERATORS[token.value];
      if (symbol !== undefined) {
        throw this.#error(
          `use "${symbol}" em vez de "${token.value}"`,
          token.location,
        );
      }
    }
  }

  #block(): Statement & { kind: 'block' } {
    const { location } = this.#expectPunctuation('{');
    const body: Statement[] = [];
    while (!this.#isPunctuation('}')) {
      if (this.#peek().kind === 'end') {
        throw this.#error('faltou fechar o bloco com "}"', location);
      }
      body.push(this.#statement());
    }
    this.#advance();
    return { kind: 'block', body, location };
  }

  #let(): Statement {
    const { location } = this.#expectKeyword('let');
    const name = this.#expectIdentifier();
    const init = this.#matchPunctuation('=') ? this.#expression() : null;
    return { kind: 'let', name, init, location };
  }

  // Atribuição (x = 1, x += 1), incremento (x++) ou expressão solta (forward())
  #simple(): Statement {
    const { location } = this.#peek();
    const expression = this.#expression();
    const next = this.#peek();
    if (next.kind === 'punctuation' && ASSIGN_OPERATORS.includes(next.value)) {
      const target = this.#assignTarget(expression);
      this.#advance();
      return {
        kind: 'assign',
        target,
        operator: next.value as AssignOperator,
        value: this.#expression(),
        location,
      };
    }
    if (this.#isPunctuation('++') || this.#isPunctuation('--')) {
      const target = this.#assignTarget(expression);
      const operator = this.#advance().value as '++' | '--';
      return { kind: 'update', target, operator, location };
    }
    return { kind: 'expression', expression, location };
  }

  #assignTarget(expression: Expression): AssignTarget {
    if (
      expression.kind === 'identifier' ||
      expression.kind === 'member' ||
      expression.kind === 'index'
    ) {
      return expression;
    }
    throw this.#error(
      'só dá para atribuir a uma variável, propriedade ou posição de lista',
      expression.location,
    );
  }

  #if(): Statement {
    const { location } = this.#expectKeyword('if');
    const condition = this.#condition();
    const then = this.#statement();
    let otherwise: Statement | null = null;
    if (this.#matchKeyword('else')) {
      // "else if" é só um if dentro do else
      otherwise = this.#statement();
    }
    return { kind: 'if', condition, then, otherwise, location };
  }

  #while(): Statement {
    const { location } = this.#expectKeyword('while');
    const condition = this.#condition();
    const body = this.#loopBody();
    return { kind: 'while', condition, body, location };
  }

  // for (let x of lista) ... ou for (início; condição; passo) ...
  #for(): Statement {
    const { location } = this.#expectKeyword('for');
    this.#expectPunctuation('(');
    if (this.#isKeyword('let') && this.#isKeywordAt(2, 'of')) {
      this.#advance();
      const name = this.#expectIdentifier();
      this.#expectKeyword('of');
      const iterable = this.#expression();
      this.#expectPunctuation(')');
      const body = this.#loopBody();
      return { kind: 'forOf', name, iterable, body, location };
    }
    let init: Statement | null = null;
    if (!this.#isPunctuation(';')) {
      init = this.#isKeyword('let') ? this.#let() : this.#simple();
    }
    this.#expectPunctuation(';');
    const condition = this.#isPunctuation(';') ? null : this.#expression();
    this.#expectPunctuation(';');
    const update = this.#isPunctuation(')') ? null : this.#simple();
    this.#expectPunctuation(')');
    const body = this.#loopBody();
    return { kind: 'for', init, condition, update, body, location };
  }

  #loopBody(): Statement {
    this.#loopDepth++;
    try {
      return this.#statement();
    } finally {
      this.#loopDepth--;
    }
  }

  #function(): Statement {
    const { location } = this.#expectKeyword('function');
    const name = this.#expectIdentifier();
    const { params, body } = this.#callable(location);
    return { kind: 'function', name, params, body, location };
  }

  // Parâmetros e corpo de uma função ou método
  #callable(location: SourceLocation): {
    params: string[];
    body: Statement[];
  } {
    this.#expectPunctuation('(');
    const params: string[] = [];
    if (!this.#isPunctuation(')')) {
      do {
        const param = this.#expectIdentifier();
        if (params.includes(param)) {
          throw this.#error(`parâmetro "${param}" repetido`, location);
        }
        params.push(param);
      } while (this.#matchPunctuation(','));
    }
    this.#expectPunctuation(')');
    // Dentro da função, break/continue não enxergam os loops de fora
    const outerLoops = this.#loopDepth;
    this.#functionDepth++;
    this.#loopDepth = 0;
    try {
      const { body } = this.#block();
      return { params, body };
    } finally {
      this.#functionDepth--;
      this.#loopDepth = outerLoops;
    }
  }

  // class Nome { constructor(a) { this.a = a } metodo() { ... } }
  #class(): Statement {
    const { location } = this.#expectKeyword('class');
    const name = this.#expectIdentifier();
    if (this.#peekIdentifier('extends')) {
      throw this.#error('herança ("extends") ainda não existe', location);
    }
    const open = this.#expectPunctuation('{');
    const methods: MethodDeclaration[] = [];
    while (!this.#matchPunctuation('}')) {
      if (this.#peek().kind === 'end') {
        throw this.#error('faltou fechar a classe com "}"', open.location);
      }
      if (this.#isKeyword('function')) {
        throw this.#error(
          'dentro da classe, escreva só o nome do método: nome(a, b) { ... }',
          this.#peek().location,
        );
      }
      const method = this.#method();
      if (methods.some((other) => other.name === method.name)) {
        throw this.#error(
          `o método "${method.name}" aparece duas vezes em ${name}`,
          method.location,
        );
      }
      methods.push(method);
      this.#matchPunctuation(';');
    }
    return { kind: 'class', name, methods, location };
  }

  #method(): MethodDeclaration {
    const { location } = this.#peek();
    const name = this.#expectIdentifier();
    this.#methodDepth++;
    try {
      const { params, body } = this.#callable(location);
      return { name, params, body, location };
    } finally {
      this.#methodDepth--;
    }
  }

  #peekIdentifier(value: string): boolean {
    const token = this.#peek();
    return token.kind === 'identifier' && token.value === value;
  }

  #return(): Statement {
    const { location } = this.#expectKeyword('return');
    if (this.#functionDepth === 0) {
      throw this.#error('"return" fora de uma função', location);
    }
    const ends =
      this.#isPunctuation(';') ||
      this.#isPunctuation('}') ||
      this.#peek().kind === 'end' ||
      this.#peek().location.line !== location.line;
    const value = ends ? null : this.#expression();
    this.#matchPunctuation(';');
    return { kind: 'return', value, location };
  }

  #jump(keyword: 'break' | 'continue'): Statement {
    const { location } = this.#advance();
    if (this.#loopDepth === 0) {
      throw this.#error(`"${keyword}" fora de um loop`, location);
    }
    this.#matchPunctuation(';');
    return { kind: keyword, location };
  }

  #condition(): Expression {
    this.#expectPunctuation('(');
    const condition = this.#expression();
    this.#expectPunctuation(')');
    return condition;
  }

  // --- expressões

  #expression(): Expression {
    return this.#or();
  }

  #or(): Expression {
    let left = this.#and();
    while (this.#isPunctuation('||')) {
      const { location } = this.#advance();
      left = {
        kind: 'logical',
        operator: '||',
        left,
        right: this.#and(),
        location,
      };
    }
    return left;
  }

  #and(): Expression {
    let left = this.#binary(0);
    while (this.#isPunctuation('&&')) {
      const { location } = this.#advance();
      left = {
        kind: 'logical',
        operator: '&&',
        left,
        right: this.#binary(0),
        location,
      };
    }
    return left;
  }

  #binary(level: number): Expression {
    const operators = BINARY_LEVELS[level];
    if (operators === undefined) {
      return this.#unary();
    }
    let left = this.#binary(level + 1);
    for (;;) {
      const token = this.#peek();
      if (
        token.kind !== 'punctuation' ||
        !(operators as readonly string[]).includes(token.value)
      ) {
        return left;
      }
      this.#advance();
      if (
        (token.value === '==' || token.value === '!=') &&
        this.#isPunctuation('=')
      ) {
        throw this.#error(
          `use "${token.value}" (não existe "${token.value}=")`,
          token.location,
        );
      }
      left = {
        kind: 'binary',
        operator: token.value as BinaryOperator,
        left,
        right: this.#binary(level + 1),
        location: token.location,
      };
    }
  }

  #unary(): Expression {
    if (this.#isPunctuation('!') || this.#isPunctuation('-')) {
      const { value, location } = this.#advance();
      return {
        kind: 'unary',
        operator: value as '!' | '-',
        operand: this.#unary(),
        location,
      };
    }
    return this.#postfix();
  }

  // Chamadas f(x), propriedades a.b e índices a[0], em qualquer combinação
  #postfix(): Expression {
    let expression = this.#primary();
    for (;;) {
      if (this.#isPunctuation('(')) {
        const { location } = this.#advance();
        const args = this.#list(')');
        expression = { kind: 'call', callee: expression, args, location };
      } else if (this.#isPunctuation('.')) {
        const { location } = this.#advance();
        const property = this.#expectIdentifier();
        expression = { kind: 'member', object: expression, property, location };
      } else if (this.#isPunctuation('[')) {
        const { location } = this.#advance();
        const index = this.#expression();
        this.#expectPunctuation(']');
        expression = { kind: 'index', object: expression, index, location };
      } else {
        return expression;
      }
    }
  }

  #primary(): Expression {
    const token = this.#advance();
    const { location } = token;
    switch (token.kind) {
      case 'number':
        return { kind: 'number', value: token.value, location };
      case 'string':
        return { kind: 'string', value: token.value, location };
      case 'identifier':
        if (token.value === 'not' && this.#startsExpression()) {
          throw this.#error(
            'use "!" em vez de "not" (ex.: !front().isEmpty)',
            location,
          );
        }
        return { kind: 'identifier', name: token.value, location };
      case 'keyword':
        if (token.value === 'this') {
          if (this.#methodDepth === 0) {
            throw this.#error(
              '"this" só existe dentro dos métodos de uma classe (o robô é "self")',
              location,
            );
          }
          return { kind: 'this', location };
        }
        if (token.value === 'new') {
          const name = this.#expectIdentifier();
          this.#expectPunctuation('(');
          return {
            kind: 'new',
            callee: { kind: 'identifier', name, location },
            args: this.#list(')'),
            location,
          };
        }
        if (token.value === 'true' || token.value === 'false') {
          return { kind: 'boolean', value: token.value === 'true', location };
        }
        if (token.value === 'null') {
          return { kind: 'null', location };
        }
        break;
      case 'punctuation':
        if (token.value === '(') {
          const inner = this.#expression();
          this.#expectPunctuation(')');
          return inner;
        }
        if (token.value === '[') {
          return { kind: 'list', items: this.#list(']'), location };
        }
        break;
      case 'end':
        throw this.#error(
          'o script terminou no meio de uma expressão',
          location,
        );
    }
    throw this.#error(`"${token.value}" inesperado`, location);
  }

  // Itens separados por vírgula até o fechamento (já depois da abertura)
  #list(close: ')' | ']'): Expression[] {
    const items: Expression[] = [];
    if (!this.#isPunctuation(close)) {
      do {
        items.push(this.#expression());
      } while (this.#matchPunctuation(','));
    }
    this.#expectPunctuation(close);
    return items;
  }

  // O próximo token pode começar uma expressão (para reconhecer "not x")
  #startsExpression(): boolean {
    const token = this.#peek();
    return (
      token.kind === 'identifier' ||
      token.kind === 'number' ||
      token.kind === 'string' ||
      (token.kind === 'keyword' &&
        ['true', 'false', 'null', 'this', 'new'].includes(token.value)) ||
      (token.kind === 'punctuation' && ['!', '['].includes(token.value))
    );
  }

  // --- tokens

  #peek(offset = 0): Token {
    const tokens = this.#tokens;
    return tokens[
      Math.min(this.#position + offset, tokens.length - 1)
    ] as Token;
  }

  #advance(): Token {
    const token = this.#peek();
    if (token.kind !== 'end') {
      this.#position++;
    }
    return token;
  }

  #isPunctuation(value: string): boolean {
    const token = this.#peek();
    return token.kind === 'punctuation' && token.value === value;
  }

  #isKeyword(value: Keyword): boolean {
    return this.#isKeywordAt(0, value);
  }

  #isKeywordAt(offset: number, value: Keyword): boolean {
    const token = this.#peek(offset);
    return token.kind === 'keyword' && token.value === value;
  }

  #matchPunctuation(value: string): boolean {
    if (this.#isPunctuation(value)) {
      this.#advance();
      return true;
    }
    return false;
  }

  #matchKeyword(value: Keyword): boolean {
    if (this.#isKeyword(value)) {
      this.#advance();
      return true;
    }
    return false;
  }

  #expectPunctuation(value: string): Token {
    if (!this.#isPunctuation(value)) {
      throw this.#unexpected(`"${value}"`);
    }
    return this.#advance();
  }

  #expectKeyword(value: Keyword): Token {
    if (!this.#isKeyword(value)) {
      throw this.#unexpected(`"${value}"`);
    }
    return this.#advance();
  }

  #expectIdentifier(): string {
    const token = this.#peek();
    if (token.kind !== 'identifier') {
      throw this.#unexpected('um nome');
    }
    this.#advance();
    return token.value;
  }

  #unexpected(expected: string): ScriptSyntaxError {
    this.#rejectWordOperator();
    const token = this.#peek();
    const found =
      token.kind === 'end' ? 'o fim do script' : `"${String(token.value)}"`;
    return this.#error(
      `esperava ${expected}, mas encontrou ${found}`,
      token.location,
    );
  }

  #error(reason: string, location: SourceLocation): ScriptSyntaxError {
    return new ScriptSyntaxError(reason, location);
  }
}

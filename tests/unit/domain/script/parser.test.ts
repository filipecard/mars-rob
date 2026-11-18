import { describe, expect, it } from 'vitest';
import { parse } from '../../../../src/domain/script/parser.js';
import { ScriptSyntaxError } from '../../../../src/domain/script/ScriptError.js';

describe('parse', () => {
  it('respeita a precedência: * antes de +, comparação antes de &&', () => {
    const [statement] = parse('1 + 2 * 3 < 10 && true').body;

    expect(statement).toMatchObject({
      kind: 'expression',
      expression: {
        kind: 'logical',
        operator: '&&',
        left: {
          kind: 'binary',
          operator: '<',
          left: {
            kind: 'binary',
            operator: '+',
            right: { kind: 'binary', operator: '*' },
          },
        },
      },
    });
  });

  it('"else if" vira um if dentro do else', () => {
    const [statement] = parse(
      'if (a) { forward() } else if (b) { turnLeft() } else { stop() }',
    ).body;

    expect(statement).toMatchObject({
      kind: 'if',
      otherwise: { kind: 'if', otherwise: { kind: 'block' } },
    });
  });

  it('aceita corpo sem chaves e ponto e vírgula opcional', () => {
    expect(
      parse('while (x) forward(); let a = 1\nlet b = 2').body,
    ).toHaveLength(3);
  });

  it('lê os dois tipos de for', () => {
    expect(
      parse('for (let i = 0; i < 3; i++) {} for (let c of see()) {}').body,
    ).toMatchObject([
      {
        kind: 'for',
        init: { kind: 'let' },
        update: { kind: 'update', operator: '++' },
      },
      { kind: 'forOf', name: 'c' },
    ]);
  });

  it('for com partes vazias', () => {
    expect(parse('for (;;) { break }').body[0]).toMatchObject({
      kind: 'for',
      init: null,
      condition: null,
      update: null,
    });
  });

  it('lê chamadas, propriedades e índices encadeados', () => {
    const [statement] = parse('see()[0].position.x').body;

    expect(statement).toMatchObject({
      expression: {
        kind: 'member',
        property: 'x',
        object: {
          kind: 'member',
          property: 'position',
          object: { kind: 'index', object: { kind: 'call' } },
        },
      },
    });
  });

  it('lê funções, atribuições compostas e return sem valor', () => {
    expect(parse('function f(a, b) { a += b; return }').body[0]).toMatchObject({
      kind: 'function',
      name: 'f',
      params: ['a', 'b'],
      body: [
        { kind: 'assign', operator: '+=' },
        { kind: 'return', value: null },
      ],
    });
  });

  it.each([
    ['return fora de função', 'return 1'],
    ['break fora de loop', 'break'],
    ['continue fora de loop', 'if (x) { continue }'],
    ['break de função dentro de loop', 'while (x) { function f() { break } }'],
    ['atribuir a uma chamada', 'front() = 1'],
    ['bloco sem fechar', 'while (x) { forward()'],
    ['parêntese faltando', 'if (x { }'],
    ['expressão incompleta', 'let x = 1 +'],
    ['parâmetro repetido', 'function f(a, a) {}'],
    ['let sem nome', 'let = 2'],
    ['símbolo solto', ')'],
  ])('rejeita %s', (_name, source) => {
    expect(() => parse(source)).toThrow(ScriptSyntaxError);
  });

  it('a mensagem diz o que esperava e o que encontrou', () => {
    expect(() => parse('if (x {')).toThrow(
      'Erro de sintaxe na linha 1, coluna 7: esperava ")", mas encontrou "{"',
    );
  });
});

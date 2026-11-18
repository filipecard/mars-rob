import { describe, expect, it } from 'vitest';
import { tokenize } from '../../../../src/domain/script/lexer.js';
import { ScriptSyntaxError } from '../../../../src/domain/script/ScriptError.js';

const values = (source: string): unknown[] =>
  tokenize(source).map((token) => token.value);

describe('tokenize', () => {
  it('separa palavras-chave, nomes, números, textos e símbolos', () => {
    expect(tokenize('let x = 1.5')).toMatchObject([
      { kind: 'keyword', value: 'let' },
      { kind: 'identifier', value: 'x' },
      { kind: 'punctuation', value: '=' },
      { kind: 'number', value: 1.5 },
      { kind: 'end' },
    ]);
  });

  it('reconhece símbolos de 2 caracteres', () => {
    expect(values('a == b != c <= d >= e && f || g ++ -- += -= *= /=')).toEqual(
      [
        'a',
        '==',
        'b',
        '!=',
        'c',
        '<=',
        'd',
        '>=',
        'e',
        '&&',
        'f',
        '||',
        'g',
        '++',
        '--',
        '+=',
        '-=',
        '*=',
        '/=',
        '',
      ],
    );
  });

  it('lê textos com aspas duplas ou simples e escapes', () => {
    expect(values(`"a\\"b" 'c\\n'`)).toEqual(['a"b', 'c\n', '']);
  });

  it('ignora comentários de linha e de bloco', () => {
    expect(values('a // fim\n/* meio\n */ b')).toEqual(['a', 'b', '']);
  });

  it('marca linha e coluna de cada token', () => {
    const [, second] = tokenize('a\n  b');

    expect(second?.location).toEqual({ line: 2, column: 3 });
  });

  it.each([
    ['caractere estranho', 'a @ b'],
    ['texto sem fechar', '"abc'],
    ['texto quebrando a linha', '"a\nb"'],
    ['comentário sem fechar', '/* abc'],
    ['escape inválido', '"\\q"'],
  ])('rejeita %s', (_name, source) => {
    expect(() => tokenize(source)).toThrow(ScriptSyntaxError);
  });

  it('o erro informa onde está o problema', () => {
    try {
      tokenize('ok\n  #');
      expect.unreachable();
    } catch (error) {
      expect((error as ScriptSyntaxError).location).toEqual({
        line: 2,
        column: 3,
      });
      expect((error as Error).message).toBe(
        'Erro de sintaxe na linha 2, coluna 3: caractere inesperado "#"',
      );
    }
  });
});

import { describe, expect, it } from 'vitest';
import {
  applySuggestion,
  complete,
  declaredNames,
  lineAndColumn,
} from '../src/logic/completion.js';
import { ENTRIES, SECTIONS } from '../src/logic/reference.js';

// Sugestões para o texto com o cursor no lugar do "|"
function at(text: string) {
  const cursor = text.indexOf('|');
  const source = text.replace('|', '');
  return { source, cursor, context: complete(source, cursor) };
}

const labels = (text: string): string[] =>
  at(text).context?.suggestions.map((s) => s.label) ?? [];

// Aplica a primeira sugestão e devolve o texto com "|" no cursor
function accept(text: string, label?: string): string {
  const { source, cursor, context } = at(text);
  if (context === null) {
    throw new Error('sem sugestões');
  }
  const suggestion =
    label === undefined
      ? context.suggestions[0]
      : context.suggestions.find((s) => s.label === label);
  if (suggestion === undefined) {
    throw new Error(`sem a sugestão ${String(label)}`);
  }
  const next = applySuggestion(source, cursor, context, suggestion);
  return `${next.source.slice(0, next.cursor)}|${next.source.slice(next.cursor)}`;
}

describe('complete', () => {
  it('sugere ações, sensores e palavras pelo começo do nome', () => {
    // ações antes das palavras da linguagem
    expect(labels('fo|')).toEqual(['forgetMap', 'forward', 'for']);
    expect(labels('tu|')).toEqual(['turnLeft', 'turnRight']);
    expect(labels('ce|')).toEqual(['cellAt']);
  });

  it('não diferencia maiúsculas', () => {
    expect(labels('STEP|')).toEqual(['stepLeft', 'stepRight']);
  });

  it('nada a sugerir sem palavra, ou quando o nome já está completo', () => {
    expect(at('|').context).toBeNull();
    expect(at('x = |').context).toBeNull();
    expect(labels('wait|')).toEqual([]);
  });

  it('depois de um ponto: campos da casa e das listas', () => {
    const fields = labels('front().|');
    expect(fields).toEqual(
      expect.arrayContaining([
        'isEmpty',
        'isUnknown',
        'visited',
        'unknownAround',
        'length',
      ]),
    );
    expect(fields).not.toContain('forward');
    expect(labels('cell.un|')).toEqual(['unknownAround']);
  });

  it('self. e .position. têm os próprios campos', () => {
    expect(labels('self.|')).toEqual(['id', 'orientation', 'position']);
    expect(labels('self.position.|')).toEqual(['x', 'y']);
    expect(labels('front().position.|')).toEqual(['x', 'y']);
  });

  it('não sugere dentro de comentários, textos nem depois de número com ponto', () => {
    expect(at('// for|').context).toBeNull();
    expect(at('print("fo|').context).toBeNull();
    expect(at("print('a', fo|").context).not.toBeNull();
    expect(at('let x = 2.|').context).toBeNull();
  });

  it('inclui variáveis, funções e parâmetros do script, antes dos nomes da linguagem', () => {
    const source = 'let passos = 0\nfunction score(cell, peso) { }\n';

    expect(labels(`${source}pa|`)).toEqual(['passos']);
    expect(labels(`${source}sc|`)).toEqual(['score']);
    expect(labels(`${source}pe|`)).toEqual(['peso']);
    expect(at(`${source}s|`).context?.suggestions[0]).toMatchObject({
      label: 'score',
      kind: 'declared',
    });
  });
});

describe('applySuggestion', () => {
  it('função sem argumentos: põe os parênteses e o cursor depois deles', () => {
    expect(accept('forw|')).toBe('forward()|');
  });

  it('função com argumentos: cursor dentro dos parênteses', () => {
    expect(accept('cell|')).toBe('cellAt(|)');
    expect(accept('sha|')).toBe('shareMap(|)');
  });

  it('campo e palavra: só o nome', () => {
    expect(accept('front().isU|')).toBe('front().isUnknown|');
    expect(accept('whi|')).toBe('while|');
  });

  it('troca só a palavra antes do cursor e mantém o resto', () => {
    expect(accept('if (front().is|) {}', 'isEmpty')).toBe(
      'if (front().isEmpty|) {}',
    );
  });

  it('não repete os parênteses quando eles já existem', () => {
    expect(accept('turnR|()')).toBe('turnRight|()');
  });

  it('função do script ganha parênteses com o cursor dentro', () => {
    expect(accept('function andar(n) {}\nan|')).toBe(
      'function andar(n) {}\nandar(|)',
    );
  });
});

describe('declaredNames', () => {
  it('let, function e parâmetros, sem repetir', () => {
    expect(
      declaredNames(
        'let a = 1\nlet a = 2\nfunction f(x, y) {}\nfor (let c of see()) {}',
      ),
    ).toEqual([
      { name: 'a', isFunction: false },
      { name: 'c', isFunction: false },
      { name: 'f', isFunction: true },
      { name: 'x', isFunction: false },
      { name: 'y', isFunction: false },
    ]);
  });
});

describe('lineAndColumn', () => {
  it('conta a partir de 0', () => {
    expect(lineAndColumn('ab\ncde', 0)).toEqual({ line: 0, column: 0 });
    expect(lineAndColumn('ab\ncde', 5)).toEqual({ line: 1, column: 2 });
  });
});

describe('referência', () => {
  it('toda entrada aparece em alguma seção', () => {
    const shown = new Set(SECTIONS.flatMap((section) => section.kinds));
    for (const entry of ENTRIES) {
      expect(shown.has(entry.kind)).toBe(true);
    }
  });
});

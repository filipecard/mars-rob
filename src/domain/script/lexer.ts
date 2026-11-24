import { ScriptSyntaxError, type SourceLocation } from './ScriptError.js';

export const KEYWORDS = [
  'let',
  'if',
  'else',
  'while',
  'for',
  'of',
  'function',
  'class',
  'new',
  'this',
  'return',
  'break',
  'continue',
  'true',
  'false',
  'null',
] as const;

export type Keyword = (typeof KEYWORDS)[number];

export type Token =
  | { kind: 'number'; value: number; location: SourceLocation }
  | { kind: 'string'; value: string; location: SourceLocation }
  | { kind: 'identifier'; value: string; location: SourceLocation }
  | { kind: 'keyword'; value: Keyword; location: SourceLocation }
  | { kind: 'punctuation'; value: string; location: SourceLocation }
  | { kind: 'end'; value: ''; location: SourceLocation };

// Os de 2 caracteres vêm primeiro para "==" não virar "=" "="
const PUNCTUATION = [
  '==',
  '!=',
  '<=',
  '>=',
  '&&',
  '||',
  '++',
  '--',
  '+=',
  '-=',
  '*=',
  '/=',
  '+',
  '-',
  '*',
  '/',
  '%',
  '<',
  '>',
  '=',
  '!',
  '(',
  ')',
  '{',
  '}',
  '[',
  ']',
  ',',
  ';',
  '.',
];

const ESCAPES: Record<string, string> = {
  n: '\n',
  t: '\t',
  '"': '"',
  "'": "'",
  '\\': '\\',
};

const isDigit = (char: string): boolean => char >= '0' && char <= '9';
const isIdentifierStart = (char: string): boolean => /[A-Za-z_]/.test(char);
const isIdentifierPart = (char: string): boolean => /[A-Za-z0-9_]/.test(char);
const isKeyword = (word: string): word is Keyword =>
  (KEYWORDS as readonly string[]).includes(word);

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  let line = 1;
  let column = 1;

  const peek = (offset = 0): string => source[index + offset] ?? '';
  const advance = (): string => {
    const char = source[index] ?? '';
    index++;
    if (char === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
    return char;
  };
  const here = (): SourceLocation => ({ line, column });

  while (index < source.length) {
    const char = peek();
    if (/\s/.test(char)) {
      advance();
      continue;
    }
    if (char === '/' && peek(1) === '/') {
      while (index < source.length && peek() !== '\n') {
        advance();
      }
      continue;
    }
    if (char === '/' && peek(1) === '*') {
      const start = here();
      advance();
      advance();
      while (!(peek() === '*' && peek(1) === '/')) {
        if (index >= source.length) {
          throw new ScriptSyntaxError('comentário /* sem fechar */', start);
        }
        advance();
      }
      advance();
      advance();
      continue;
    }

    const location = here();
    if (isDigit(char)) {
      let text = '';
      while (isDigit(peek())) {
        text += advance();
      }
      if (peek() === '.' && isDigit(peek(1))) {
        text += advance();
        while (isDigit(peek())) {
          text += advance();
        }
      }
      tokens.push({ kind: 'number', value: Number(text), location });
      continue;
    }
    if (isIdentifierStart(char)) {
      let word = '';
      while (isIdentifierPart(peek())) {
        word += advance();
      }
      tokens.push(
        isKeyword(word)
          ? { kind: 'keyword', value: word, location }
          : { kind: 'identifier', value: word, location },
      );
      continue;
    }
    if (char === '"' || char === "'") {
      tokens.push({ kind: 'string', value: readString(char), location });
      continue;
    }
    const symbol = PUNCTUATION.find((p) => source.startsWith(p, index));
    if (symbol === undefined) {
      throw new ScriptSyntaxError(`caractere inesperado "${char}"`, location);
    }
    for (let i = 0; i < symbol.length; i++) {
      advance();
    }
    tokens.push({ kind: 'punctuation', value: symbol, location });
  }
  tokens.push({ kind: 'end', value: '', location: here() });
  return tokens;

  function readString(quote: string): string {
    const start = here();
    advance();
    let text = '';
    for (;;) {
      const char = peek();
      if (char === '' || char === '\n') {
        throw new ScriptSyntaxError('texto sem aspas de fechamento', start);
      }
      advance();
      if (char === quote) {
        return text;
      }
      if (char === '\\') {
        const escaped = ESCAPES[advance()];
        if (escaped === undefined) {
          throw new ScriptSyntaxError('sequência de escape inválida', here());
        }
        text += escaped;
        continue;
      }
      text += char;
    }
  }
}

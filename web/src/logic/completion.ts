import { ENTRIES, type Entry, type EntryKind } from './reference.js';

// Autocomplete do editor de scripts: descobre a palavra que está sendo digitada
// e sugere nomes da linguagem, campos (depois de um ponto) e o que o script declarou.

export interface Suggestion {
  label: string;
  kind: EntryKind | 'declared';
  detail: string;
  description: string;
  // Texto inserido no lugar da palavra; o cursor vai para `cursorOffset` dentro dele
  insert: string;
  cursorOffset: number;
}

export interface CompletionContext {
  // Onde começa a palavra que vai ser trocada
  from: number;
  prefix: string;
  suggestions: Suggestion[];
}

const WORD_BEFORE = /[A-Za-z_][A-Za-z0-9_]*$|$/;

// Ordem em que aparecem quando há empate no começo da palavra
const KIND_ORDER: readonly (EntryKind | 'declared')[] = [
  'declared',
  'cellField',
  'selfField',
  'positionField',
  'listMember',
  'action',
  'sensor',
  'function',
  'keyword',
];

const TOP_LEVEL: readonly EntryKind[] = [
  'action',
  'sensor',
  'function',
  'keyword',
];

export function complete(
  source: string,
  cursor: number,
): CompletionContext | null {
  const before = source.slice(0, cursor);
  const line = before.slice(before.lastIndexOf('\n') + 1);
  if (insideCommentOrString(line)) {
    return null;
  }
  const prefix = WORD_BEFORE.exec(line)?.[0] ?? '';
  const from = cursor - prefix.length;
  const member = memberBase(line.slice(0, line.length - prefix.length));
  if (member === null && prefix === '') {
    return null;
  }

  const candidates: Suggestion[] =
    member === null
      ? [
          ...declaredNames(source).map(declaredSuggestion),
          ...ENTRIES.filter((e) => TOP_LEVEL.includes(e.kind)).map(fromEntry),
        ]
      : ENTRIES.filter((e) => memberKinds(member).includes(e.kind)).map(
          fromEntry,
        );

  const lower = prefix.toLowerCase();
  const seen = new Set<string>();
  const suggestions = candidates
    .filter(
      (s) => s.label.toLowerCase().startsWith(lower) && s.label !== prefix,
    )
    .filter((s) => {
      // Um nome declarado que repete um da linguagem aparece uma vez só
      if (seen.has(s.label)) {
        return false;
      }
      seen.add(s.label);
      return true;
    })
    .sort(
      (a, b) =>
        KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
        a.label.localeCompare(b.label),
    );
  return suggestions.length === 0 ? null : { from, prefix, suggestions };
}

// Troca a palavra digitada pela sugestão
export function applySuggestion(
  source: string,
  cursor: number,
  context: CompletionContext,
  suggestion: Suggestion,
): { source: string; cursor: number } {
  // Se já há "(" logo depois (ex.: trocando o nome de uma chamada), não repete os parênteses
  const hasParens = source[cursor] === '(' && suggestion.insert.endsWith(')');
  const insert = hasParens
    ? suggestion.insert.slice(0, suggestion.insert.indexOf('('))
    : suggestion.insert;
  const offset = hasParens ? insert.length : suggestion.cursorOffset;
  return {
    source: source.slice(0, context.from) + insert + source.slice(cursor),
    cursor: context.from + offset,
  };
}

function fromEntry(entry: Entry): Suggestion {
  const call = entry.params !== undefined;
  const insert = call ? `${entry.name}()` : entry.name;
  return {
    label: entry.name,
    kind: entry.kind,
    detail: entry.signature,
    description: entry.description,
    insert,
    // Com argumentos, o cursor fica dentro dos parênteses
    cursorOffset:
      call && entry.params !== 0 ? entry.name.length + 1 : insert.length,
  };
}

function declaredSuggestion({
  name,
  isFunction,
}: {
  name: string;
  isFunction: boolean;
}): Suggestion {
  const insert = isFunction ? `${name}()` : name;
  return {
    label: name,
    kind: 'declared',
    detail: isFunction ? `${name}(...)` : name,
    description: isFunction ? 'Função do script.' : 'Variável do script.',
    insert,
    cursorOffset: isFunction ? name.length + 1 : insert.length,
  };
}

// Nomes declarados com let, function ou como parâmetro de função
export function declaredNames(
  source: string,
): { name: string; isFunction: boolean }[] {
  const found = new Map<string, boolean>();
  const add = (name: string, isFunction: boolean): void => {
    if (!found.has(name)) {
      found.set(name, isFunction);
    }
  };
  for (const [, name = ''] of source.matchAll(/\blet\s+([A-Za-z_]\w*)/g)) {
    add(name, false);
  }
  for (const [, name = '', params = ''] of source.matchAll(
    /\bfunction\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/g,
  )) {
    add(name, true);
    for (const param of params.split(',')) {
      const trimmed = param.trim();
      if (/^[A-Za-z_]\w*$/.test(trimmed)) {
        add(trimmed, false);
      }
    }
  }
  return [...found].map(([name, isFunction]) => ({ name, isFunction }));
}

// O que vem antes do ponto: `self.`, `.position.` ou outra coisa (casa, lista)
type MemberBase = 'self' | 'position' | 'value';

function memberBase(text: string): MemberBase | null {
  // `2.` é um número sendo digitado, não um campo
  if (!text.endsWith('.') || /(^|[^\w])\d+\.$/.test(text)) {
    return null;
  }
  const word = /([A-Za-z_]\w*)\s*\.$/.exec(text)?.[1];
  if (word === 'self') {
    return 'self';
  }
  if (word === 'position') {
    return 'position';
  }
  return 'value';
}

function memberKinds(base: MemberBase): readonly EntryKind[] {
  switch (base) {
    case 'self':
      return ['selfField'];
    case 'position':
      return ['positionField'];
    case 'value':
      return ['cellField', 'listMember'];
  }
}

// Sem sugestões dentro de comentário de linha ou de texto entre aspas
function insideCommentOrString(line: string): boolean {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quote !== null) {
      if (char === '\\') {
        i++;
      } else if (char === quote) {
        quote = null;
      }
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '/' && line[i + 1] === '/') {
      return true;
    }
  }
  return quote !== null;
}

// Linha e coluna do índice (para posicionar a lista de sugestões)
export function lineAndColumn(
  source: string,
  index: number,
): { line: number; column: number } {
  const before = source.slice(0, index);
  const line = before.split('\n').length - 1;
  return { line, column: index - (before.lastIndexOf('\n') + 1) };
}

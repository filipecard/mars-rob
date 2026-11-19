import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BUILTIN_NAMES,
  cellRecord,
  selfRecord,
} from '../../src/domain/script/builtins.js';

// A referência da interface web (web/src/logic/reference.ts) e docs/linguagem.md
// precisam citar tudo o que a linguagem oferece.
const read = (path: string): string =>
  readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const reference = read('web/src/logic/reference.ts');
const guide = read('docs/linguagem.md');

const cellFields = [
  ...cellRecord({
    type: 'empty',
    x: 0,
    y: 0,
    robot: null,
    visited: false,
    unknownAround: 0,
  }).fields.keys(),
];
const selfFields = [
  ...selfRecord({ id: 1, x: 0, y: 0, orientation: 'north' }).fields.keys(),
];

describe('documentação da linguagem — RN18', () => {
  it.each(BUILTIN_NAMES)('%s está na referência da web e no guia', (name) => {
    expect(reference).toContain(`name: '${name}'`);
    expect(guide).toContain(`\`${name}(`);
  });

  it.each(cellFields)('campo de casa %s está documentado', (field) => {
    expect(reference).toMatch(
      new RegExp(`name: '${field}',\\s+kind: 'cellField'`),
    );
    expect(guide).toContain(`\`${field}\``);
  });

  it.each(selfFields)('campo de self %s está documentado', (field) => {
    expect(reference).toMatch(
      new RegExp(`name: '${field}',\\s+kind: 'selfField'`),
    );
    expect(guide).toContain(`self.${field}`);
  });
});

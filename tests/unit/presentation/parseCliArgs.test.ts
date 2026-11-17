import { describe, expect, it } from 'vitest';
import {
  parseCliArgs,
  USAGE,
} from '../../../src/presentation/cli/parseCliArgs.js';

describe('parseCliArgs', () => {
  it('sem argumentos não informa arquivo de configuração', () => {
    expect(parseCliArgs([])).toEqual({
      ok: true,
      args: { configPath: undefined },
    });
  });

  it.each([[['--config', 'outra.json']], [['--config=outra.json']]])(
    'lê o caminho do arquivo de configuração: %j',
    (args) => {
      expect(parseCliArgs(args)).toEqual({
        ok: true,
        args: { configPath: 'outra.json' },
      });
    },
  );

  it.each([
    [['--desconhecido']],
    [['posicional']],
    [['--config']],
    [['--limite', '10']],
  ])('rejeita argumentos inesperados e mostra o uso: %j', (args) => {
    expect(parseCliArgs(args)).toEqual({
      ok: false,
      message: `Argumentos inválidos. ${USAGE}`,
    });
  });
});

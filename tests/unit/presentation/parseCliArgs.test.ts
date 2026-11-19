import { describe, expect, it } from 'vitest';
import {
  parseCliArgs,
  USAGE,
} from '../../../src/presentation/cli/parseCliArgs.js';

describe('parseCliArgs', () => {
  it('sem argumentos não informa arquivo de configuração', () => {
    expect(parseCliArgs([])).toEqual({
      ok: true,
      args: { configPath: undefined, server: false, port: 3000 },
    });
  });

  it.each([[['--config', 'outra.json']], [['--config=outra.json']]])(
    'lê o caminho do arquivo de configuração: %j',
    (args) => {
      expect(parseCliArgs(args)).toEqual({
        ok: true,
        args: { configPath: 'outra.json', server: false, port: 3000 },
      });
    },
  );

  it.each([
    [['--servidor'], 3000],
    [['--servidor', '--porta', '8080'], 8080],
    [['--servidor', '--porta=65535'], 65535],
  ])('modo servidor: %j', (args, port) => {
    expect(parseCliArgs(args)).toEqual({
      ok: true,
      args: { configPath: undefined, server: true, port },
    });
  });

  it.each([
    [['--porta', '3000']],
    [['--servidor', '--porta', '0']],
    [['--servidor', '--porta', '70000']],
    [['--servidor', '--porta', 'abc']],
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

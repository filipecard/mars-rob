import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  loadConfig,
  parseConfig,
} from '../../../src/infrastructure/config/AppConfig.js';

describe('parseConfig', () => {
  it('objeto vazio usa os valores padrão', () => {
    expect(parseConfig({})).toEqual({ ok: true, config: DEFAULT_CONFIG });
  });

  it('lê todos os campos', () => {
    expect(
      parseConfig({
        limite: 10,
        obstaculos: { quantidade: 6, tamanhoMaximo: 3 },
        semente: 42,
      }),
    ).toEqual({
      ok: true,
      config: { limit: 10, obstacles: { count: 6, maxSize: 3 }, seed: 42 },
    });
  });

  it('completa com o padrão o que faltar', () => {
    expect(parseConfig({ obstaculos: { quantidade: 2 } })).toEqual({
      ok: true,
      config: { ...DEFAULT_CONFIG, obstacles: { count: 2, maxSize: 4 } },
    });
  });

  it('aceita zero obstáculos e semente null', () => {
    expect(
      parseConfig({ obstaculos: { quantidade: 0 }, semente: null }),
    ).toMatchObject({
      ok: true,
      config: { obstacles: { count: 0 }, seed: null },
    });
  });

  it.each<[unknown, string]>([
    [[], 'objeto JSON'],
    [null, 'objeto JSON'],
    [{ limite: 0 }, '"limite"'],
    [{ limite: '15' }, '"limite"'],
    [{ limite: 2.5 }, '"limite"'],
    [{ obstaculos: 4 }, '"obstaculos" deve ser um objeto'],
    [{ obstaculos: { quantidade: -1 } }, '"obstaculos.quantidade"'],
    [{ obstaculos: { tamanhoMaximo: 0 } }, '"obstaculos.tamanhoMaximo"'],
    [{ semente: -1 }, '"semente"'],
    [{ semente: 2 ** 32 }, '"semente"'],
    [{ semente: 'abc' }, '"semente"'],
  ])('rejeita %j', (raw, text) => {
    const result = parseConfig(raw);

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).toContain(text);
  });
});

describe('loadConfig', () => {
  async function tempFile(content: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'mars-rob-'));
    const file = join(dir, 'config.json');
    await writeFile(file, content);
    return file;
  }

  it('lê um arquivo informado', async () => {
    const file = await tempFile('{ "limite": 7, "semente": 5 }');

    expect(await loadConfig(file)).toEqual({
      ok: true,
      config: { ...DEFAULT_CONFIG, limit: 7, seed: 5 },
    });
  });

  it('erro quando o arquivo informado não existe', async () => {
    const result = await loadConfig(join(tmpdir(), 'mars-rob-nao-existe.json'));

    expect(result.ok ? '' : result.message).toContain('não foi possível ler');
  });

  it('erro quando o JSON é inválido', async () => {
    const result = await loadConfig(await tempFile('{ limite: 7 '));

    expect(result.ok ? '' : result.message).toContain('não é um JSON válido');
  });

  it('o arquivo padrão do projeto é válido', async () => {
    expect((await loadConfig()).ok).toBe(true);
  });
});

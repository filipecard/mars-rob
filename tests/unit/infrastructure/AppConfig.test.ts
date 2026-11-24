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
        robos: 3,
        obstaculos: { quantidade: 6, tamanhoMaximo: 3 },
        semente: 42,
      }),
    ).toEqual({
      ok: true,
      config: {
        limit: 10,
        robots: 3,
        obstacles: { count: 6, maxSize: 3 },
        seed: 42,
        robot: DEFAULT_CONFIG.robot,
        world: DEFAULT_CONFIG.world,
      },
    });
  });

  it('lê bateria, armazenamento e mundo — RN24, RN25, RN26', () => {
    const result = parseConfig({
      bateria: { maxima: 150, recargaPorTick: 10, solarACadaTicks: 0 },
      armazenamento: { robo: 12, armazem: 80 },
      mundo: { pedras: 5, arvoresIniciais: 0, vidaDaArvore: 0 },
    });

    expect(result).toMatchObject({
      ok: true,
      config: {
        robot: { battery: 150, rechargeRate: 10, solarEvery: 0, cargo: 12 },
        world: {
          warehouse: 80,
          stones: 5,
          initialTrees: 0,
          treeLifespan: 0,
          // o que não veio fica no padrão
          oreUses: DEFAULT_CONFIG.world.oreUses,
        },
      },
    });
  });

  it.each([
    [18, 6],
    [21, 7],
  ])('com limite %i aceita até %i robôs — RN13', (limite, robos) => {
    expect(parseConfig({ limite, robos })).toMatchObject({
      ok: true,
      config: { limit: limite, robots: robos },
    });
  });

  it('completa com o padrão o que faltar', () => {
    expect(parseConfig({ obstaculos: { quantidade: 2 } })).toEqual({
      ok: true,
      config: { ...DEFAULT_CONFIG, obstacles: { count: 2, maxSize: 8 } },
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
    [{ robos: 0 }, '"robos" deve ser um inteiro de 1 a 10'],
    [{ robos: 11 }, '"robos"'],
    [
      { limite: 17, robos: 6 },
      'de 1 a 5 (1 robô a cada 3 de limite; o limite é 17)',
    ],
    [{ robos: '2' }, '"robos"'],
    [{ obstaculos: 4 }, '"obstaculos" deve ser um objeto'],
    [{ obstaculos: { quantidade: -1 } }, '"obstaculos.quantidade"'],
    [{ obstaculos: { tamanhoMaximo: 0 } }, '"obstaculos.tamanhoMaximo"'],
    [{ semente: -1 }, '"semente"'],
    [{ semente: 2 ** 32 }, '"semente"'],
    [{ semente: 'abc' }, '"semente"'],
    [{ bateria: 3 }, '"bateria" deve ser um objeto'],
    [
      { bateria: { maxima: 0 } },
      '"bateria.maxima" deve ser um inteiro maior ou igual a 1',
    ],
    [{ mundo: { pedras: -1 } }, '"mundo.pedras"'],
    [{ armazenamento: { robo: 1.5 } }, '"armazenamento.robo"'],
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

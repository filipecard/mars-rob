import { readFile } from 'node:fs/promises';
import { maxRobots } from '../../domain/entities/Fleet.js';
import { MAX_SEED } from '../random/seededRandom.js';

export const DEFAULT_CONFIG_PATH = 'mars-rob.config.json';

export interface AppConfig {
  limit: number;
  // RN13: quantos robôs, de 1 a maxRobots(limit)
  robots: number;
  obstacles: { count: number; maxSize: number };
  // null: sorteia uma semente nova a cada execução
  seed: number | null;
}

export const DEFAULT_CONFIG: AppConfig = {
  limit: 15,
  robots: 1,
  obstacles: { count: 4, maxSize: 4 },
  seed: null,
};

export type ConfigResult =
  { ok: true; config: AppConfig } | { ok: false; message: string };

// Formato do arquivo (todas as chaves são opcionais; o que faltar usa o padrão):
// { "limite": 15, "robos": 1, "obstaculos": { "quantidade": 4, "tamanhoMaximo": 4 }, "semente": null }
export function parseConfig(raw: unknown): ConfigResult {
  if (!isObject(raw)) {
    return fail('a configuração deve ser um objeto JSON');
  }
  const obstacles = raw['obstaculos'] ?? {};
  if (!isObject(obstacles)) {
    return fail('"obstaculos" deve ser um objeto');
  }

  const limit = readInteger(raw['limite'], DEFAULT_CONFIG.limit, 1);
  if (limit === undefined) {
    return fail('"limite" deve ser um inteiro maior que 0');
  }
  const robots = readInteger(
    raw['robos'],
    DEFAULT_CONFIG.robots,
    1,
    maxRobots(limit),
  );
  if (robots === undefined) {
    return fail(
      `"robos" deve ser um inteiro de 1 a ${String(maxRobots(limit))} (1 robô a cada 3 de limite; o limite é ${String(limit)})`,
    );
  }
  const count = readInteger(
    obstacles['quantidade'],
    DEFAULT_CONFIG.obstacles.count,
    0,
  );
  if (count === undefined) {
    return fail(
      '"obstaculos.quantidade" deve ser um inteiro maior ou igual a 0',
    );
  }
  const maxSize = readInteger(
    obstacles['tamanhoMaximo'],
    DEFAULT_CONFIG.obstacles.maxSize,
    1,
  );
  if (maxSize === undefined) {
    return fail('"obstaculos.tamanhoMaximo" deve ser um inteiro maior que 0');
  }
  const rawSeed = raw['semente'] ?? null;
  const seed = rawSeed === null ? null : readInteger(rawSeed, 0, 0, MAX_SEED);
  if (seed === undefined) {
    return fail(
      `"semente" deve ser null ou um inteiro de 0 a ${String(MAX_SEED)}`,
    );
  }

  return {
    ok: true,
    config: { limit, robots, obstacles: { count, maxSize }, seed },
  };
}

// Lê o arquivo. Se o caminho não foi informado e o arquivo padrão não existe, usa o padrão.
export async function loadConfig(path?: string): Promise<ConfigResult> {
  const file = path ?? DEFAULT_CONFIG_PATH;
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (path === undefined && isMissingFile(error)) {
      return { ok: true, config: DEFAULT_CONFIG };
    }
    return fail(`não foi possível ler "${file}"`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail(`"${file}" não é um JSON válido`);
  }
  return parseConfig(raw);
}

function readInteger(
  value: unknown,
  fallback: number,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): number | undefined {
  if (value === undefined) {
    return fallback;
  }
  return Number.isInteger(value) &&
    (value as number) >= min &&
    (value as number) <= max
    ? (value as number)
    : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMissingFile(error: unknown): boolean {
  return isObject(error) && error['code'] === 'ENOENT';
}

function fail(reason: string): ConfigResult {
  return { ok: false, message: `Configuração inválida: ${reason}` };
}

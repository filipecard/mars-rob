import { readFile } from 'node:fs/promises';
import { maxRobots } from '../../domain/entities/Fleet.js';
import {
  DEFAULT_ROBOT_SETTINGS,
  type RobotSettings,
} from '../../domain/entities/Robot.js';
import {
  DEFAULT_WORLD_SETTINGS,
  type WorldSettings,
} from '../../domain/world/World.js';
import { MAX_SEED } from '../random/seededRandom.js';

export const DEFAULT_CONFIG_PATH = 'mars-rob.config.json';

export interface AppConfig {
  limit: number;
  // RN13: quantos robôs, de 1 a maxRobots(limit)
  robots: number;
  obstacles: { count: number; maxSize: number };
  // null: sorteia uma semente nova a cada execução
  seed: number | null;
  // RN24, RN25
  robot: RobotSettings;
  // RN23, RN25–RN27
  world: WorldSettings;
}

export const DEFAULT_CONFIG: AppConfig = {
  limit: 30,
  robots: 1,
  obstacles: { count: 20, maxSize: 8 },
  seed: null,
  robot: DEFAULT_ROBOT_SETTINGS,
  world: DEFAULT_WORLD_SETTINGS,
};

export type ConfigResult =
  { ok: true; config: AppConfig } | { ok: false; message: string };

// Cada número de uma seção: [caminho no arquivo, valor mínimo]
type Fields<T> = Readonly<Record<keyof T & string, readonly [string, number]>>;

const ROBOT_FIELDS: Fields<RobotSettings> = {
  battery: ['bateria.maxima', 1],
  rechargeRate: ['bateria.recargaPorTick', 1],
  solarEvery: ['bateria.solarACadaTicks', 0],
  cargo: ['armazenamento.robo', 1],
};

const WORLD_FIELDS: Fields<WorldSettings> = {
  warehouse: ['armazenamento.armazem', 1],
  stones: ['mundo.pedras', 0],
  initialTrees: ['mundo.arvoresIniciais', 0],
  initialOres: ['mundo.minerios', 0],
  treeEvery: ['mundo.novaArvoreACadaTicks', 0],
  oreEvery: ['mundo.novoMinerioACadaTicks', 0],
  maxTrees: ['mundo.maxArvores', 0],
  maxOres: ['mundo.maxMinerios', 0],
  treeGrowEvery: ['mundo.arvoreCresceACadaTicks', 0],
  treeMaxCells: ['mundo.tamanhoMaximoArvore', 1],
  branchEvery: ['mundo.galhoACadaTicks', 0],
  treeLifespan: ['mundo.vidaDaArvore', 0],
  oreUses: ['mundo.usosDoMinerio', 1],
};

const SECTIONS = ['obstaculos', 'bateria', 'armazenamento', 'mundo'];

// Formato do arquivo (todas as chaves são opcionais; o que faltar usa o padrão):
// {
//   "limite": 30, "robos": 1, "obstaculos": { "quantidade": 20, "tamanhoMaximo": 8 },
//   "semente": null,
//   "bateria": { "maxima": 100, "recargaPorTick": 20, "solarACadaTicks": 5 },
//   "armazenamento": { "robo": 5, "armazem": 10 },
//   "mundo": { "pedras": 40, "arvoresIniciais": 10, "minerios": 6, ... }
// }
export function parseConfig(raw: unknown): ConfigResult {
  if (!isObject(raw)) {
    return fail('a configuração deve ser um objeto JSON');
  }
  const badSection = SECTIONS.find(
    (section) => raw[section] !== undefined && !isObject(raw[section]),
  );
  if (badSection !== undefined) {
    return fail(`"${badSection}" deve ser um objeto`);
  }
  const obstacles = (raw['obstaculos'] ?? {}) as Record<string, unknown>;

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
  const robot = readFields(raw, ROBOT_FIELDS, DEFAULT_ROBOT_SETTINGS);
  if (typeof robot === 'string') {
    return fail(robot);
  }
  const world = readFields(raw, WORLD_FIELDS, DEFAULT_WORLD_SETTINGS);
  if (typeof world === 'string') {
    return fail(world);
  }

  return {
    ok: true,
    config: {
      limit,
      robots,
      obstacles: { count, maxSize },
      seed,
      robot,
      world,
    },
  };
}

// Lê cada "secao.chave"; devolve a mensagem de erro do primeiro valor inválido
function readFields<T extends object>(
  raw: Record<string, unknown>,
  fields: Fields<T>,
  defaults: T,
): T | string {
  const result: Record<string, number> = { ...defaults } as Record<
    string,
    number
  >;
  const entries: [string, readonly [string, number]][] = Object.entries(fields);
  for (const [field, [path, min]] of entries) {
    const [section = '', key = ''] = path.split('.');
    const values = (raw[section] ?? {}) as Record<string, unknown>;
    const value = readInteger(values[key], result[field] ?? 0, min);
    if (value === undefined) {
      return `"${path}" deve ser um inteiro maior ou igual a ${String(min)}`;
    }
    result[field] = value;
  }
  return result as T;
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

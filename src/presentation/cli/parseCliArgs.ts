import { parseArgs } from 'node:util';

export const DEFAULT_PORT = 3000;

export const USAGE =
  'Uso: npm run dev -- [--config caminho/do/arquivo.json] [--servidor [--porta 3000]]';

export interface CliArgs {
  configPath: string | undefined;
  // Sobe a API + WebSocket para a interface web em vez da CLI
  server: boolean;
  port: number;
}

export type ParseCliArgsResult =
  { ok: true; args: CliArgs } | { ok: false; message: string };

const PORT_PATTERN = /^[1-9]\d{0,4}$/;

export function parseCliArgs(args: readonly string[]): ParseCliArgsResult {
  const invalid = {
    ok: false,
    message: `Argumentos inválidos. ${USAGE}`,
  } as const;
  try {
    const { values } = parseArgs({
      args: [...args],
      options: {
        config: { type: 'string' },
        servidor: { type: 'boolean', default: false },
        porta: { type: 'string' },
      },
      strict: true,
      allowPositionals: false,
    });
    const { config, servidor, porta } = values;
    if (porta !== undefined && (!servidor || !PORT_PATTERN.test(porta))) {
      return invalid;
    }
    const port = porta === undefined ? DEFAULT_PORT : Number(porta);
    if (port > 65535) {
      return invalid;
    }
    return { ok: true, args: { configPath: config, server: servidor, port } };
  } catch {
    return invalid;
  }
}

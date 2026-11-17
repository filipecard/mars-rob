import { parseArgs } from 'node:util';

export const USAGE = 'Uso: npm run dev -- [--config caminho/do/arquivo.json]';

export interface CliArgs {
  configPath: string | undefined;
}

export type ParseCliArgsResult =
  { ok: true; args: CliArgs } | { ok: false; message: string };

export function parseCliArgs(args: readonly string[]): ParseCliArgsResult {
  try {
    const { values } = parseArgs({
      args: [...args],
      options: { config: { type: 'string' } },
      strict: true,
      allowPositionals: false,
    });
    return { ok: true, args: { configPath: values.config } };
  } catch {
    return { ok: false, message: `Argumentos inválidos. ${USAGE}` };
  }
}

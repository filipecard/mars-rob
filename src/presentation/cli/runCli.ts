import type { AdvanceClock } from '../../application/use-cases/AdvanceClock.js';
import type { DescribeMap } from '../../application/use-cases/DescribeMap.js';
import type { DescribeSimulation } from '../../application/use-cases/DescribeSimulation.js';
import type { ExecuteOrders } from '../../application/use-cases/ExecuteOrders.js';
import type { ForgetMap } from '../../application/use-cases/ForgetMap.js';
import type { LoadScript } from '../../application/use-cases/LoadScript.js';
import type { StopProgram } from '../../application/use-cases/StopProgram.js';
import { formatMapView } from './formatMap.js';
import {
  formatEvent,
  formatForgotten,
  formatLoadScriptResult,
  formatOrderResult,
  formatRobotState,
  unknownRobot,
} from './formatResult.js';

export const EXIT_COMMAND = 'sair';
export const MAP_COMMAND = 'mapa';
export const SCRIPT_COMMAND = 'script';
export const SCRIPT_END = 'fim';
export const TICKS_COMMAND = 'ticks';
export const STOP_COMMAND = 'parar';
export const FORGET_COMMAND = 'apagar';

// Depois de cada ordem ou script, a CLI roda os ticks até todos pararem, com este limite
export const CLI_MAX_TICKS = 1000;

export const MAP_USAGE = `Use "${MAP_COMMAND} ID" para ver o mapa de um robô, ex.: ${MAP_COMMAND} 1`;
export const SCRIPT_USAGE = `Use "${SCRIPT_COMMAND} ID", escreva o script e termine com uma linha "${SCRIPT_END}"`;
export const TICKS_USAGE = `Use "${TICKS_COMMAND} N" para avançar até N ticks, ex.: ${TICKS_COMMAND} 10`;
export const STOP_USAGE = `Use "${STOP_COMMAND} ID" para parar o programa de um robô, ex.: ${STOP_COMMAND} 1`;

export const FORGET_USAGE = `Use "${FORGET_COMMAND} ID" para apagar o mapa de um robô, ex.: ${FORGET_COMMAND} 1`;

const ID_PATTERN = /^[1-9]\d*$/;

export interface CliUseCases {
  executeOrders: ExecuteOrders;
  describeMap: DescribeMap;
  describeSimulation: DescribeSimulation;
  loadScript: LoadScript;
  advanceClock: AdvanceClock;
  stopProgram: StopProgram;
  forgetMap: ForgetMap;
}

// 'script': a CLI está recebendo as linhas de um script
export type CliMode = 'command' | 'script';

export interface CliIO {
  print: (text: string) => void;
  // Chamado depois de cada linha, com o modo da próxima
  prompt?: (mode: CliMode) => void;
}

export async function runCli(
  useCases: CliUseCases,
  lines: AsyncIterable<string>,
  { print, prompt = () => undefined }: CliIO,
): Promise<void> {
  const session = new Session(useCases);
  for await (const line of lines) {
    if (session.mode === 'command' && line.trim() === EXIT_COMMAND) {
      return;
    }
    const output = await session.respond(line);
    if (output !== '') {
      print(output);
    }
    prompt(session.mode);
  }
}

class Session {
  readonly #useCases: CliUseCases;
  // Script sendo digitado: o robô e as linhas até agora
  #script: { robotId: number; lines: string[] } | null = null;

  constructor(useCases: CliUseCases) {
    this.#useCases = useCases;
  }

  get mode(): CliMode {
    return this.#script === null ? 'command' : 'script';
  }

  async respond(line: string): Promise<string> {
    if (this.#script !== null) {
      return this.#scriptLine(this.#script, line);
    }
    const [command = '', ...rest] = line.trim().split(/\s+/);
    const argument = rest.join(' ');
    switch (command) {
      case MAP_COMMAND:
        return this.#map(argument);
      case SCRIPT_COMMAND:
        if (!ID_PATTERN.test(argument)) {
          return SCRIPT_USAGE;
        }
        this.#script = { robotId: Number(argument), lines: [] };
        return '';
      case TICKS_COMMAND:
        return ID_PATTERN.test(argument)
          ? this.#run(Number(argument), [])
          : TICKS_USAGE;
      case STOP_COMMAND:
        return this.#stop(argument);
      case FORGET_COMMAND:
        return this.#forget(argument);
      default:
        return this.#orders(line);
    }
  }

  async #map(argument: string): Promise<string> {
    if (!ID_PATTERN.test(argument)) {
      return MAP_USAGE;
    }
    const result = await this.#useCases.describeMap.execute(Number(argument));
    return result.ok ? formatMapView(result.map) : unknownRobot(result.robotId);
  }

  async #scriptLine(
    script: { robotId: number; lines: string[] },
    line: string,
  ): Promise<string> {
    if (line.trim() !== SCRIPT_END) {
      script.lines.push(line);
      return '';
    }
    this.#script = null;
    const result = await this.#useCases.loadScript.execute(
      script.robotId,
      script.lines.join('\n'),
    );
    const error = formatLoadScriptResult(result);
    return error ?? this.#run(CLI_MAX_TICKS, [script.robotId]);
  }

  async #stop(argument: string): Promise<string> {
    if (!ID_PATTERN.test(argument)) {
      return STOP_USAGE;
    }
    const result = await this.#useCases.stopProgram.execute(Number(argument));
    if (!result.ok) {
      return unknownRobot(result.robotId);
    }
    return result.stopped
      ? `Robô ${argument}: programa parado`
      : `Robô ${argument}: não estava rodando nenhum programa`;
  }

  // RN20
  async #forget(argument: string): Promise<string> {
    if (!ID_PATTERN.test(argument)) {
      return FORGET_USAGE;
    }
    const result = await this.#useCases.forgetMap.execute(Number(argument));
    if (!result.ok) {
      return unknownRobot(result.robotId);
    }
    return `Robô ${argument} apagou o mapa: ${formatForgotten(result.forgotten)}`;
  }

  // Linha vazia: nenhuma ordem, nada a mostrar
  async #orders(line: string): Promise<string> {
    const results = await this.#useCases.executeOrders.execute(line);
    const rejected = results
      .map(formatOrderResult)
      .filter((text) => text !== null);
    const accepted = results.flatMap((result) =>
      result.ok ? [result.robotId] : [],
    );
    if (accepted.length === 0) {
      return rejected.join('\n');
    }
    const report = await this.#run(CLI_MAX_TICKS, accepted);
    return [...rejected, report].join('\n');
  }

  // Avança o relógio e mostra os eventos e o estado final dos robôs envolvidos
  async #run(maxTicks: number, robots: number[]): Promise<string> {
    const { advanced, events, running } =
      await this.#useCases.advanceClock.execute(maxTicks);
    if (advanced === 0 && robots.length === 0) {
      return 'Nenhum robô está rodando programa';
    }
    const involved = new Set([...robots, ...events.map((e) => e.robot)]);
    const { robots: states } =
      await this.#useCases.describeSimulation.execute();
    const output = [
      ...events.map(formatEvent).filter((text) => text !== null),
      ...states
        .filter(({ id }) => involved.has(id))
        .map(({ map }) => formatRobotState(map.robot)),
    ];
    if (running.length > 0) {
      output.push(
        `Ainda rodando: ${running.map((id) => `robô ${String(id)}`).join(', ')}. Use "${TICKS_COMMAND} N" para avançar ou "${STOP_COMMAND} ID" para parar.`,
      );
    }
    return output.join('\n');
  }
}

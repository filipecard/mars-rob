import type { AdvanceClock } from '../../application/use-cases/AdvanceClock.js';
import type { DescribeMap } from '../../application/use-cases/DescribeMap.js';
import type { DescribeSimulation } from '../../application/use-cases/DescribeSimulation.js';
import type { ExecuteOrders } from '../../application/use-cases/ExecuteOrders.js';
import type { ForgetMap } from '../../application/use-cases/ForgetMap.js';
import type { LoadScript } from '../../application/use-cases/LoadScript.js';
import type {
  ListSaves,
  LoadGame,
  SaveGame,
} from '../../application/use-cases/SaveGame.js';
import type { StopProgram } from '../../application/use-cases/StopProgram.js';
import type { UpgradeRobot } from '../../application/use-cases/UpgradeRobot.js';
import { UPGRADE_ALIASES } from '../names.js';
import { formatMapView } from './formatMap.js';
import {
  formatEvent,
  formatForgotten,
  formatLoadResult,
  formatLoadScriptResult,
  formatOrderResult,
  formatRobotState,
  formatSaveResult,
  formatStatus,
  formatUpgradeResult,
  unknownRobot,
} from './formatResult.js';

export const EXIT_COMMAND = 'sair';
export const MAP_COMMAND = 'mapa';
export const SCRIPT_COMMAND = 'script';
export const SCRIPT_END = 'fim';
export const TICKS_COMMAND = 'ticks';
export const STOP_COMMAND = 'parar';
export const FORGET_COMMAND = 'apagar';
export const STATUS_COMMAND = 'estado';
export const UPGRADE_COMMAND = 'melhorar';
export const SAVE_COMMAND = 'salvar';
export const LOAD_COMMAND = 'carregar';
export const SAVES_COMMAND = 'salvos';

// Depois de cada ordem ou script, a CLI roda os ticks até todos pararem, com este limite
export const CLI_MAX_TICKS = 1000;

export const MAP_USAGE = `Use "${MAP_COMMAND} ID" para ver o mapa de um robô, ex.: ${MAP_COMMAND} 1`;
export const SCRIPT_USAGE = `Use "${SCRIPT_COMMAND} ID", escreva o script e termine com uma linha "${SCRIPT_END}"`;
export const TICKS_USAGE = `Use "${TICKS_COMMAND} N" para avançar até N ticks, ex.: ${TICKS_COMMAND} 10`;
export const STOP_USAGE = `Use "${STOP_COMMAND} ID" para parar o programa de um robô, ex.: ${STOP_COMMAND} 1`;

export const FORGET_USAGE = `Use "${FORGET_COMMAND} ID" para apagar o mapa de um robô, ex.: ${FORGET_COMMAND} 1`;
export const STATUS_USAGE = `Use "${STATUS_COMMAND} ID" para ver bateria, compartimento e melhorias de um robô, ex.: ${STATUS_COMMAND} 1`;
export const UPGRADE_USAGE = `Use "${UPGRADE_COMMAND} ID MELHORIA" (picareta, bateria, compartimento, visao ou armazem), com o robô na base, ex.: ${UPGRADE_COMMAND} 1 picareta`;
export const SAVE_USAGE = `Use "${SAVE_COMMAND} NOME" para salvar a simulação, ex.: ${SAVE_COMMAND} partida1`;
export const LOAD_USAGE = `Use "${LOAD_COMMAND} NOME" para carregar uma simulação salva, ex.: ${LOAD_COMMAND} partida1`;

const ID_PATTERN = /^[1-9]\d*$/;

export interface CliUseCases {
  executeOrders: ExecuteOrders;
  describeMap: DescribeMap;
  describeSimulation: DescribeSimulation;
  loadScript: LoadScript;
  advanceClock: AdvanceClock;
  stopProgram: StopProgram;
  forgetMap: ForgetMap;
  upgradeRobot: UpgradeRobot;
  saveGame: SaveGame;
  loadGame: LoadGame;
  listSaves: ListSaves;
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
          ? this.#run(Number(argument), [], false)
          : TICKS_USAGE;
      case STATUS_COMMAND:
        return this.#status(argument);
      case UPGRADE_COMMAND:
        return this.#upgrade(rest);
      case SAVE_COMMAND:
        return argument === ''
          ? SAVE_USAGE
          : formatSaveResult(await this.#useCases.saveGame.execute(argument));
      case LOAD_COMMAND:
        return argument === ''
          ? LOAD_USAGE
          : formatLoadResult(await this.#useCases.loadGame.execute(argument));
      case SAVES_COMMAND:
        return this.#saves();
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

  // RN24, RN25, RN28
  async #status(argument: string): Promise<string> {
    if (!ID_PATTERN.test(argument)) {
      return STATUS_USAGE;
    }
    const id = Number(argument);
    const { robots, warehouse } =
      await this.#useCases.describeSimulation.execute();
    const robot = robots.find((candidate) => candidate.id === id);
    return robot === undefined
      ? unknownRobot(id)
      : formatStatus(robot, warehouse);
  }

  // RN28
  async #upgrade([id = '', name = '', ...extra]: string[]): Promise<string> {
    if (!ID_PATTERN.test(id) || name === '' || extra.length > 0) {
      return UPGRADE_USAGE;
    }
    const upgrade = UPGRADE_ALIASES[name.toLowerCase()] ?? name;
    return formatUpgradeResult(
      await this.#useCases.upgradeRobot.execute(Number(id), upgrade),
    );
  }

  // RN30
  async #saves(): Promise<string> {
    const names = await this.#useCases.listSaves.execute();
    return names.length === 0
      ? 'Nenhuma simulação salva'
      : `Simulações salvas: ${names.join(', ')}`;
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

  // Avança o relógio e mostra os eventos e o estado final dos robôs envolvidos.
  // untilIdle false (comando ticks): avança tudo, mesmo sem robô rodando, e o mundo anda.
  async #run(
    maxTicks: number,
    robots: number[],
    untilIdle = true,
  ): Promise<string> {
    const { advanced, events, running, tick } =
      await this.#useCases.advanceClock.execute(maxTicks, { untilIdle });
    const involved = new Set([...robots, ...events.map((e) => e.robot)]);
    const { robots: states } =
      await this.#useCases.describeSimulation.execute();
    const output = [
      ...events.map(formatEvent).filter((text) => text !== null),
      ...states
        .filter(({ id }) => involved.has(id))
        .map(({ map }) => formatRobotState(map.robot)),
    ];
    if (!untilIdle) {
      output.push(
        `Avançou ${String(advanced)} ${advanced === 1 ? 'tick' : 'ticks'}; agora é o tick ${String(tick)}.`,
      );
    }
    if (running.length > 0) {
      output.push(
        `Ainda rodando: ${running.map((id) => `robô ${String(id)}`).join(', ')}. Use "${TICKS_COMMAND} N" para avançar ou "${STOP_COMMAND} ID" para parar.`,
      );
    }
    return output.join('\n');
  }
}

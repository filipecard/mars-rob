import type { EventDTO } from '../api/types.js';
import { ORIENTATION_NAMES } from './mapCells.js';

// quiet: passos de rotina; print: saída do script; warn: algo bloqueou; error: o script quebrou
export type EventTone = 'quiet' | 'info' | 'print' | 'warn' | 'error';

export interface EventLine {
  id: number;
  tick: number;
  robot: number;
  text: string;
  tone: EventTone;
}

const at = ({ x, y }: { x: number; y: number }): string =>
  `(${String(x)}, ${String(y)})`;

const cells = (count: number): string =>
  count === 1 ? '1 casa nova' : `${String(count)} casas novas`;

export function describeEvent(event: EventDTO): {
  text: string;
  tone: EventTone;
} {
  switch (event.kind) {
    case 'moved':
      return { text: `andou para ${at(event.position)}`, tone: 'quiet' };
    case 'turned':
      return {
        text: `virou para o ${ORIENTATION_NAMES[event.orientation]}`,
        tone: 'quiet',
      };
    case 'waited':
      return { text: 'esperou', tone: 'quiet' };
    case 'blocked': {
      const where = at(event.at);
      const text =
        event.reason === 'edge'
          ? `parou na borda da malha, antes de ${where}`
          : event.reason === 'obstacle'
            ? `parou diante de um obstáculo em ${where}`
            : `parou diante do robô ${String(event.other)} em ${where}`;
      return { text, tone: 'warn' };
    }
    case 'shared':
      return {
        text: `enviou o mapa ao robô ${String(event.to)}: ${cells(event.added)}`,
        tone: 'info',
      };
    case 'shareFailed': {
      const to = String(event.to);
      const text =
        event.reason === 'notAdjacent'
          ? `não enviou o mapa: o robô ${to} não está ao lado`
          : event.reason === 'unknownRobot'
            ? `não enviou o mapa: o robô ${to} não existe`
            : 'não enviou o mapa: não dá para enviar para si mesmo';
      return { text, tone: 'warn' };
    }
    case 'forgot':
      return {
        text: `apagou o mapa: esqueceu ${String(event.forgotten)} ${event.forgotten === 1 ? 'casa' : 'casas'}`,
        tone: 'info',
      };
    case 'printed':
      return { text: event.text, tone: 'print' };
    case 'finished':
      return { text: 'terminou o programa', tone: 'info' };
    case 'error':
      return {
        text: `erro na linha ${String(event.line)}, coluna ${String(event.column)}: ${event.message}`,
        tone: 'error',
      };
  }
}

export const LOG_LIMIT = 400;

// Acrescenta os eventos novos no fim e guarda só os últimos `limit`
export function appendEvents(
  log: readonly EventLine[],
  events: readonly EventDTO[],
  limit = LOG_LIMIT,
): EventLine[] {
  let next = (log.at(-1)?.id ?? 0) + 1;
  const added = events.map((event) => ({
    id: next++,
    tick: event.tick,
    robot: event.robot,
    ...describeEvent(event),
  }));
  return [...log, ...added].slice(-limit);
}

export interface ScriptErrorInfo {
  line: number;
  column: number;
  message: string;
}

// O último erro de execução de cada robô, para marcar a linha no editor
export function lastErrors(
  events: readonly EventDTO[],
): Map<number, ScriptErrorInfo> {
  const errors = new Map<number, ScriptErrorInfo>();
  for (const event of events) {
    if (event.kind === 'error') {
      const { line, column, message } = event;
      errors.set(event.robot, { line, column, message });
    }
  }
  return errors;
}

// Do mais novo para o mais antigo, filtrando por robô e escondendo os passos de rotina
export function visibleLines(
  log: readonly EventLine[],
  { robot, showSteps }: { robot: number | null; showSteps: boolean },
): EventLine[] {
  return log
    .filter((line) => robot === null || line.robot === robot)
    .filter((line) => showSteps || line.tone !== 'quiet')
    .reverse();
}

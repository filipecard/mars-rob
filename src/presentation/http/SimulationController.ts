import type { EventDTO, SimulationDTO } from '../../application/dto.js';
import type { AdvanceClock } from '../../application/use-cases/AdvanceClock.js';
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
import { Clock, type ClockDTO, type Timers } from './Clock.js';

export interface HttpUseCases {
  executeOrders: ExecuteOrders;
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

// O que o WebSocket envia a cada mudança: o estado inteiro e os eventos novos
export interface UpdateMessage {
  type: 'update';
  state: SimulationDTO;
  clock: ClockDTO;
  events: EventDTO[];
}

export interface ApiRequest {
  method: string;
  path: string;
  // JSON já lido do corpo (undefined se não havia corpo)
  body: unknown;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

type Listener = (update: UpdateMessage) => void;

const ROBOT_ROUTE = /^\/api\/robots\/([1-9]\d*)\/(script|stop|forget|upgrade)$/;

const error = (status: number, message: string): ApiResponse => ({
  status,
  body: { error: message },
});

const NOT_FOUND = error(404, 'Rota não encontrada');

// RN17: a API da interface web. Liga as rotas aos casos de uso, toca o relógio e
// avisa os inscritos (WebSocket) a cada mudança.
export class SimulationController {
  readonly #useCases: HttpUseCases;
  readonly #listeners = new Set<Listener>();
  readonly #messages: { from: number; to: number; text: string; tick: number }[] = [];
  readonly clock: Clock;

  constructor(
    useCases: HttpUseCases,
    options: { timers?: Timers; onError?: (error: unknown) => void } = {},
  ) {
    this.#useCases = useCases;
    this.clock = new Clock(() => this.#advance(1), options);
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  async snapshot(events: EventDTO[] = []): Promise<UpdateMessage> {
    return {
      type: 'update',
      state: await this.#useCases.describeSimulation.execute(),
      clock: this.clock.toDTO(),
      events,
    };
  }

  async handle({ method, path, body }: ApiRequest): Promise<ApiResponse> {
    const robot = ROBOT_ROUTE.exec(path);
    if (robot !== null) {
      const [, id = '', action = ''] = robot;
      if (method !== 'POST') {
        return NOT_FOUND;
      }
      switch (action) {
        case 'script':
          return this.#loadScript(Number(id), body);
        case 'stop':
          return this.#stop(Number(id));
        case 'upgrade':
          return this.#upgrade(Number(id), body);
        default:
          return this.#forget(Number(id));
      }
    }
    switch (`${method} ${path}`) {
      case 'GET /api/state':
        return { status: 200, body: await this.snapshot() };
      case 'GET /api/messages':
        return { status: 200, body: this.#messages };
      case 'POST /api/messages':
        return this.#message(body);
      case 'POST /api/orders':
        return this.#orders(body);
      case 'POST /api/clock/play':
        this.clock.play();
        return this.#changed();
      case 'POST /api/clock/pause':
        this.clock.pause();
        return this.#changed();
      case 'POST /api/clock/step':
        await this.#advance(1);
        return { status: 200, body: this.clock.toDTO() };
      case 'PUT /api/clock/speed':
        return this.#speed(body);
      case 'GET /api/saves':
        return {
          status: 200,
          body: await this.#useCases.listSaves.execute(),
        };
      case 'POST /api/save':
        return this.#save(body);
      case 'POST /api/load':
        return this.#load(body);
      default:
        return NOT_FOUND;
    }
  }

  async #orders(body: unknown): Promise<ApiResponse> {
    const line = field(body, 'line');
    if (line === undefined) {
      return error(400, 'Envie {"line": "1:NN 2:L"}');
    }
    const results = await this.#useCases.executeOrders.execute(line);
    await this.#notify([]);
    return { status: 200, body: results };
  }

  async #message(body: unknown): Promise<ApiResponse> {
    const from = numberField(body, 'from');
    const to = numberField(body, 'to');
    const text = field(body, 'text')?.trim();
    if (from === undefined || to === undefined || text === undefined || text.length === 0 || text.length > 240) {
      return error(400, 'Envie {"from": 1, "to": 2, "text": "mensagem"} com até 240 caracteres.');
    }
    const state = await this.#useCases.describeSimulation.execute();
    const sender = state.robots.find((robot) => robot.id === from);
    const receiver = state.robots.find((robot) => robot.id === to);
    if (sender === undefined || receiver === undefined) return error(404, 'Robô não encontrado.');
    if (Math.abs(sender.map.robot.x - receiver.map.robot.x) + Math.abs(sender.map.robot.y - receiver.map.robot.y) !== 1) {
      return error(400, 'Os robôs precisam estar lado a lado para trocar mensagens.');
    }
    this.#messages.push({ from, to, text, tick: state.tick });
    if (this.#messages.length > 50) this.#messages.shift();
    await this.#notify([]);
    return { status: 200, body: this.#messages };
  }

  async #loadScript(id: number, body: unknown): Promise<ApiResponse> {
    const source = field(body, 'source');
    if (source === undefined) {
      return error(400, 'Envie {"source": "forward()"}');
    }
    const result = await this.#useCases.loadScript.execute(id, source);
    if (!result.ok) {
      return {
        status: result.error === 'UNKNOWN_ROBOT' ? 404 : 400,
        body: result,
      };
    }
    await this.#notify([]);
    return { status: 200, body: result };
  }

  async #stop(id: number): Promise<ApiResponse> {
    const result = await this.#useCases.stopProgram.execute(id);
    if (!result.ok) {
      return { status: 404, body: result };
    }
    await this.#notify([]);
    return { status: 200, body: result };
  }

  // RN20
  async #forget(id: number): Promise<ApiResponse> {
    const result = await this.#useCases.forgetMap.execute(id);
    if (!result.ok) {
      return { status: 404, body: result };
    }
    await this.#notify([]);
    return { status: 200, body: result };
  }

  // RN28
  async #upgrade(id: number, body: unknown): Promise<ApiResponse> {
    const upgrade = field(body, 'upgrade');
    if (upgrade === undefined) {
      return error(400, 'Envie {"upgrade": "pickaxe"} ou {"upgrade": "axe"}');
    }
    const result = await this.#useCases.upgradeRobot.execute(id, upgrade);
    if (!result.ok) {
      return {
        status: result.error === 'UNKNOWN_ROBOT' ? 404 : 400,
        body: result,
      };
    }
    await this.#notify([]);
    return { status: 200, body: result };
  }

  // RN30
  async #save(body: unknown): Promise<ApiResponse> {
    const name = field(body, 'name');
    if (name === undefined) {
      return error(400, 'Envie {"name": "partida1"}');
    }
    const result = await this.#useCases.saveGame.execute(name);
    return { status: result.ok ? 200 : 400, body: result };
  }

  async #load(body: unknown): Promise<ApiResponse> {
    const name = field(body, 'name');
    if (name === undefined) {
      return error(400, 'Envie {"name": "partida1"}');
    }
    const result = await this.#useCases.loadGame.execute(name);
    if (!result.ok) {
      return {
        status: result.error === 'NOT_FOUND' ? 404 : 400,
        body: result,
      };
    }
    await this.#notify([]);
    return { status: 200, body: result };
  }

  async #speed(body: unknown): Promise<ApiResponse> {
    const value =
      typeof body === 'object' && body !== null && 'ticksPerSecond' in body
        ? body.ticksPerSecond
        : undefined;
    try {
      this.clock.setSpeed(value as number);
    } catch (cause) {
      return error(400, (cause as Error).message);
    }
    return this.#changed();
  }

  async #changed(): Promise<ApiResponse> {
    await this.#notify([]);
    return { status: 200, body: this.clock.toDTO() };
  }

  // Avança e avisa. O mundo anda mesmo sem robô rodando (RN26, RN27).
  async #advance(ticks: number): Promise<void> {
    const { events } = await this.#useCases.advanceClock.execute(ticks, {
      untilIdle: false,
    });
    await this.#notify(events);
  }

  async #notify(events: EventDTO[]): Promise<void> {
    if (this.#listeners.size === 0) {
      return;
    }
    const update = await this.snapshot(events);
    for (const listener of this.#listeners) {
      listener(update);
    }
  }
}

function field(body: unknown, name: string): string | undefined {
  if (typeof body !== 'object' || body === null || !(name in body)) {
    return undefined;
  }
  const value = (body as Record<string, unknown>)[name];
  return typeof value === 'string' ? value : undefined;
}

function numberField(body: unknown, name: string): number | undefined {
  if (typeof body !== 'object' || body === null || !(name in body)) return undefined;
  const value = (body as Record<string, unknown>)[name];
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

import type { EventDTO, SimulationDTO } from '../../application/dto.js';
import type { AdvanceClock } from '../../application/use-cases/AdvanceClock.js';
import type { DescribeSimulation } from '../../application/use-cases/DescribeSimulation.js';
import type { ExecuteOrders } from '../../application/use-cases/ExecuteOrders.js';
import type { ForgetMap } from '../../application/use-cases/ForgetMap.js';
import type { LoadScript } from '../../application/use-cases/LoadScript.js';
import type { StopProgram } from '../../application/use-cases/StopProgram.js';
import { Clock, type ClockDTO, type Timers } from './Clock.js';

export interface HttpUseCases {
  executeOrders: ExecuteOrders;
  describeSimulation: DescribeSimulation;
  loadScript: LoadScript;
  advanceClock: AdvanceClock;
  stopProgram: StopProgram;
  forgetMap: ForgetMap;
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

const ROBOT_ROUTE = /^\/api\/robots\/([1-9]\d*)\/(script|stop|forget)$/;

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
  readonly clock: Clock;

  constructor(
    useCases: HttpUseCases,
    options: { timers?: Timers; onError?: (error: unknown) => void } = {},
  ) {
    this.#useCases = useCases;
    this.clock = new Clock(() => this.#advance(1, false), options);
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
        default:
          return this.#forget(Number(id));
      }
    }
    switch (`${method} ${path}`) {
      case 'GET /api/state':
        return { status: 200, body: await this.snapshot() };
      case 'POST /api/orders':
        return this.#orders(body);
      case 'POST /api/clock/play':
        this.clock.play();
        return this.#changed();
      case 'POST /api/clock/pause':
        this.clock.pause();
        return this.#changed();
      case 'POST /api/clock/step':
        await this.#advance(1, true);
        return { status: 200, body: this.clock.toDTO() };
      case 'PUT /api/clock/speed':
        return this.#speed(body);
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

  // Avança e avisa. Pelo relógio, sem nenhum robô rodando, não avisa nada.
  async #advance(ticks: number, always: boolean): Promise<void> {
    const { advanced, events } =
      await this.#useCases.advanceClock.execute(ticks);
    if (advanced > 0 || always) {
      await this.#notify(events);
    }
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

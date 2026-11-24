import type {
  ClockDTO,
  ForgetMapResult,
  LoadScriptResult,
  OrderResult,
  StopProgramResult,
  SaveResult,
  LoadResult,
  UpgradeResult,
} from './types.js';

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

// Chamadas à API (rotas em src/presentation/http/SimulationController.ts)
export class ApiClient {
  readonly #fetch: Fetch;

  constructor(fetchImpl: Fetch = (input, init) => fetch(input, init)) {
    this.#fetch = fetchImpl;
  }

  sendOrders(line: string): Promise<OrderResult[]> {
    return this.#request('POST', '/api/orders', { line });
  }

  // Erro de sintaxe volta como resultado (status 400), não como exceção
  loadScript(robotId: number, source: string): Promise<LoadScriptResult> {
    return this.#request('POST', `/api/robots/${String(robotId)}/script`, {
      source,
    });
  }

  stopProgram(robotId: number): Promise<StopProgramResult> {
    return this.#request('POST', `/api/robots/${String(robotId)}/stop`);
  }

  // RN20
  forgetMap(robotId: number): Promise<ForgetMapResult> {
    return this.#request('POST', `/api/robots/${String(robotId)}/forget`);
  }

  upgradeRobot(robotId: number, upgrade: string): Promise<UpgradeResult> {
    return this.#request('POST', `/api/robots/${String(robotId)}/upgrade`, {
      upgrade,
    });
  }

  listSaves(): Promise<string[]> {
    return this.#request('GET', '/api/saves');
  }

  saveGame(name: string): Promise<SaveResult> {
    return this.#request('POST', '/api/save', { name });
  }

  loadGame(name: string): Promise<LoadResult> {
    return this.#request('POST', '/api/load', { name });
  }

  play(): Promise<ClockDTO> {
    return this.#request('POST', '/api/clock/play');
  }

  pause(): Promise<ClockDTO> {
    return this.#request('POST', '/api/clock/pause');
  }

  step(): Promise<ClockDTO> {
    return this.#request('POST', '/api/clock/step');
  }

  setSpeed(ticksPerSecond: number): Promise<ClockDTO> {
    return this.#request('PUT', '/api/clock/speed', { ticksPerSecond });
  }

  async #request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await this.#fetch(path, {
      method,
      headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = (await response.json()) as T;
    // 400/404 com resultado do caso de uso (ok: false) são respostas esperadas
    if (
      !response.ok &&
      (typeof data !== 'object' || data === null || !('ok' in data))
    ) {
      throw new Error(`A API respondeu ${String(response.status)}`);
    }
    return data;
  }
}

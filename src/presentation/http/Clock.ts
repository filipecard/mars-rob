// RN17: o relógio da interface web. Quando está tocando, chama `tick` várias vezes
// por segundo; um tick só começa quando o anterior termina.

export const MIN_SPEED = 1;
export const MAX_SPEED = 20;
export const DEFAULT_SPEED = 4;

export interface Timers {
  setInterval: (callback: () => void, ms: number) => unknown;
  clearInterval: (handle: unknown) => void;
}

const realTimers: Timers = {
  setInterval: (callback, ms) => setInterval(callback, ms),
  clearInterval: (handle) => {
    clearInterval(handle as Parameters<typeof clearInterval>[0]);
  },
};

export interface ClockDTO {
  playing: boolean;
  ticksPerSecond: number;
}

export class Clock {
  readonly #tick: () => Promise<void>;
  readonly #timers: Timers;
  readonly #onError: (error: unknown) => void;
  #handle: unknown = null;
  #speed = DEFAULT_SPEED;
  #busy = false;

  constructor(
    tick: () => Promise<void>,
    {
      timers = realTimers,
      onError = (error: unknown) => {
        console.error(error);
      },
    }: { timers?: Timers; onError?: (error: unknown) => void } = {},
  ) {
    this.#tick = tick;
    this.#timers = timers;
    this.#onError = onError;
  }

  get playing(): boolean {
    return this.#handle !== null;
  }

  get ticksPerSecond(): number {
    return this.#speed;
  }

  toDTO(): ClockDTO {
    return { playing: this.playing, ticksPerSecond: this.#speed };
  }

  play(): void {
    if (this.playing) {
      return;
    }
    this.#handle = this.#timers.setInterval(() => {
      void this.#run();
    }, 1000 / this.#speed);
  }

  pause(): void {
    if (this.#handle !== null) {
      this.#timers.clearInterval(this.#handle);
      this.#handle = null;
    }
  }

  // Ticks por segundo, de MIN_SPEED a MAX_SPEED. Se estiver tocando, continua na nova velocidade.
  setSpeed(ticksPerSecond: number): void {
    if (
      !Number.isInteger(ticksPerSecond) ||
      ticksPerSecond < MIN_SPEED ||
      ticksPerSecond > MAX_SPEED
    ) {
      throw new RangeError(
        `A velocidade deve ser um inteiro de ${String(MIN_SPEED)} a ${String(MAX_SPEED)}`,
      );
    }
    this.#speed = ticksPerSecond;
    if (this.playing) {
      this.pause();
      this.play();
    }
  }

  async #run(): Promise<void> {
    if (this.#busy) {
      return;
    }
    this.#busy = true;
    try {
      await this.#tick();
    } catch (error) {
      this.#onError(error);
    } finally {
      this.#busy = false;
    }
  }
}

import { toEventDTO, type EventDTO } from '../dto.js';
import type { SimulationRepository } from '../ports/SimulationRepository.js';

export interface AdvanceResult {
  // Tick atual, depois de avançar
  tick: number;
  // Quantos ticks passaram nesta chamada
  advanced: number;
  events: EventDTO[];
  // Robôs que ainda têm programa
  running: number[];
}

export interface AdvanceOptions {
  // true: para assim que nenhum robô tiver programa (a CLI roda até os robôs pararem).
  // false: avança todos os ticks; o mundo continua andando (RN26, RN27).
  untilIdle?: boolean;
}

// RN17: avança até `maxTicks` ticks
export class AdvanceClock {
  readonly #simulations: SimulationRepository;

  constructor(simulations: SimulationRepository) {
    this.#simulations = simulations;
  }

  async execute(
    maxTicks: number,
    { untilIdle = true }: AdvanceOptions = {},
  ): Promise<AdvanceResult> {
    if (!Number.isInteger(maxTicks) || maxTicks < 0) {
      throw new RangeError('maxTicks deve ser um inteiro >= 0');
    }
    const simulation = await this.#simulations.get();
    const events: EventDTO[] = [];
    let advanced = 0;
    while (advanced < maxTicks && !(untilIdle && simulation.idle)) {
      events.push(...simulation.advance().map(toEventDTO));
      advanced++;
    }
    await this.#simulations.save(simulation);
    return {
      tick: simulation.tick,
      advanced,
      events,
      running: simulation.running,
    };
  }
}

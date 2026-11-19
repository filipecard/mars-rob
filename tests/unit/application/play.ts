import type { SimulationRepository } from '../../../src/application/ports/SimulationRepository.js';
import {
  AdvanceClock,
  type AdvanceResult,
} from '../../../src/application/use-cases/AdvanceClock.js';
import {
  ExecuteOrders,
  type OrderResult,
} from '../../../src/application/use-cases/ExecuteOrders.js';

// Dá as ordens da linha e roda os ticks até todos os robôs pararem
export async function play(
  repository: SimulationRepository,
  line: string,
): Promise<AdvanceResult & { results: OrderResult[] }> {
  const results = await new ExecuteOrders(repository).execute(line);
  const run = await new AdvanceClock(repository).execute(1000);
  return { ...run, results };
}

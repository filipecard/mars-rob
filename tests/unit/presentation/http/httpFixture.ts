import { AdvanceClock } from '../../../../src/application/use-cases/AdvanceClock.js';
import { DescribeSimulation } from '../../../../src/application/use-cases/DescribeSimulation.js';
import { ExecuteOrders } from '../../../../src/application/use-cases/ExecuteOrders.js';
import { LoadScript } from '../../../../src/application/use-cases/LoadScript.js';
import { StopProgram } from '../../../../src/application/use-cases/StopProgram.js';
import { Fleet } from '../../../../src/domain/entities/Fleet.js';
import { Grid } from '../../../../src/domain/value-objects/Grid.js';
import { Position } from '../../../../src/domain/value-objects/Position.js';
import { InMemorySimulationRepository } from '../../../../src/infrastructure/repositories/InMemorySimulationRepository.js';
import type { Timers } from '../../../../src/presentation/http/Clock.js';
import {
  SimulationController,
  type UpdateMessage,
} from '../../../../src/presentation/http/SimulationController.js';

// Malha limite 3; robô 1 em (0,0) e robô 2 em (3,3)
export function controller(timers?: Timers): SimulationController {
  const repository = InMemorySimulationRepository.of(
    Fleet.place(Grid.square(3), [
      { position: Position.origin() },
      { position: Position.create(3, 3) },
    ]),
  );
  return new SimulationController(
    {
      executeOrders: new ExecuteOrders(repository),
      describeSimulation: new DescribeSimulation(repository),
      loadScript: new LoadScript(repository),
      advanceClock: new AdvanceClock(repository),
      stopProgram: new StopProgram(repository),
    },
    timers === undefined ? {} : { timers },
  );
}

export function collect(target: SimulationController): UpdateMessage[] {
  const updates: UpdateMessage[] = [];
  target.subscribe((update) => {
    updates.push(update);
  });
  return updates;
}

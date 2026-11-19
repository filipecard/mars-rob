import type { FleetRepository } from '../../application/ports/FleetRepository.js';
import { Fleet } from '../../domain/entities/Fleet.js';
import { Grid } from '../../domain/value-objects/Grid.js';

export class InMemoryFleetRepository implements FleetRepository {
  #fleet: Fleet;

  constructor(fleet: Fleet = Fleet.create(Grid.standard(), 1, Math.random)) {
    this.#fleet = fleet;
  }

  get(): Promise<Fleet> {
    return Promise.resolve(this.#fleet);
  }

  save(fleet: Fleet): Promise<void> {
    this.#fleet = fleet;
    return Promise.resolve();
  }
}

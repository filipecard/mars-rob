import type { Fleet } from '../../domain/entities/Fleet.js';

export interface FleetRepository {
  get(): Promise<Fleet>;
  save(fleet: Fleet): Promise<void>;
}

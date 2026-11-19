import type { Fleet } from '../entities/Fleet.js';
import { CollisionError } from '../errors/CollisionError.js';
import { NotAdjacentError } from '../errors/NotAdjacentError.js';
import { ObstacleError } from '../errors/ObstacleError.js';
import { OutOfGridError } from '../errors/OutOfGridError.js';
import { UnknownRobotError } from '../errors/UnknownRobotError.js';
import type { Action } from '../script/host.js';
import { ScriptProcess } from '../script/interpreter.js';
import { Command } from '../value-objects/Command.js';
import type { Orientation } from '../value-objects/Orientation.js';
import type { Position } from '../value-objects/Position.js';
import { FleetRobotHost } from './FleetRobotHost.js';
import { OrderProgram, type Program } from './Program.js';

export type ProgramKind = Program['kind'];

export type BlockReason = 'edge' | 'obstacle' | 'robot';

export type ShareFailure = 'notAdjacent' | 'unknownRobot' | 'self';

// O que aconteceu com um robô num tick
export type SimulationEvent = { tick: number; robot: number } & (
  | { kind: 'moved'; position: Position; orientation: Orientation }
  | { kind: 'turned'; position: Position; orientation: Orientation }
  | { kind: 'waited' }
  | {
      kind: 'blocked';
      reason: BlockReason;
      at: Position;
      // RN15: o robô que estava no caminho
      other: number | null;
    }
  | { kind: 'shared'; to: number; added: number }
  | { kind: 'shareFailed'; to: number; reason: ShareFailure }
  // RN20: quantas casas o robô deixou de conhecer
  | { kind: 'forgot'; forgotten: number }
  | { kind: 'printed'; text: string }
  | { kind: 'finished' }
  | { kind: 'error'; message: string; line: number; column: number }
);

// Evento sem o tick e o robô, que a simulação preenche
type EventBody = SimulationEvent extends infer E
  ? E extends SimulationEvent
    ? Omit<E, 'tick' | 'robot'>
    : never
  : never;

// RN03: letra do passo relativo de cada ação de movimento
const MOVES = {
  forward: 'N',
  backward: 'S',
  stepRight: 'L',
  stepLeft: 'O',
} as const;

const TURNS = { turnRight: 'D', turnLeft: 'E' } as const;

interface Running {
  program: Program;
  lastActionSucceeded: boolean;
}

// RN17: o relógio da frota. A cada tick, cada robô com programa executa no
// máximo 1 ação, em ordem de ID. Sensores e contas do script não gastam tick.
export class Simulation {
  readonly fleet: Fleet;
  readonly #running = new Map<number, Running>();
  #tick = 0;
  #events: SimulationEvent[] = [];

  constructor(fleet: Fleet) {
    this.fleet = fleet;
  }

  // Quantos ticks já passaram. Só conta tick em que algum robô tinha programa.
  get tick(): number {
    return this.#tick;
  }

  // IDs dos robôs com programa, em ordem
  get running(): number[] {
    return this.fleet.ids.filter((id) => this.#running.has(id));
  }

  get idle(): boolean {
    return this.#running.size === 0;
  }

  programOf(id: number): ProgramKind | null {
    this.fleet.robot(id);
    return this.#running.get(id)?.program.kind ?? null;
  }

  // RN18: troca o programa do robô por um script. Erro de sintaxe: ScriptSyntaxError,
  // e o programa anterior continua.
  loadScript(id: number, source: string): void {
    this.fleet.robot(id);
    const host = new FleetRobotHost(this.fleet, id, (text) => {
      this.#emit(id, { kind: 'printed', text });
    });
    const process = ScriptProcess.compile(source, host);
    this.#start(id, {
      kind: 'script',
      next: (lastActionSucceeded) => process.next(lastActionSucceeded),
    });
  }

  // RN17: uma ordem direta entra na fila do robô. Se ele estava rodando um
  // script, o script é substituído.
  giveOrder(id: number, actions: readonly Action[]): void {
    this.fleet.robot(id);
    const current = this.#running.get(id)?.program;
    if (current instanceof OrderProgram) {
      current.append(actions);
      return;
    }
    this.#start(id, new OrderProgram(actions));
  }

  // Encerra o programa do robô; devolve se havia um
  stop(id: number): boolean {
    this.fleet.robot(id);
    return this.#running.delete(id);
  }

  // RN20: o operador apaga o mapa do robô, fora dos ticks (não gasta tick nem
  // mexe no programa). Devolve quantas casas ele deixou de conhecer.
  forgetMap(id: number): number {
    return this.fleet.robot(id).forgetMap();
  }

  // RN17: avança 1 tick e devolve o que aconteceu. Sem programas, não faz nada.
  advance(): SimulationEvent[] {
    if (this.idle) {
      return [];
    }
    this.#tick++;
    this.#events = [];
    for (const id of this.running) {
      const running = this.#running.get(id);
      if (running === undefined) {
        continue;
      }
      const step = running.program.next(running.lastActionSucceeded);
      switch (step.kind) {
        case 'action':
          running.lastActionSucceeded = this.#apply(id, step.action);
          break;
        case 'finished':
          this.#running.delete(id);
          this.#emit(id, { kind: 'finished' });
          break;
        case 'error':
          this.#running.delete(id);
          this.#emit(id, {
            kind: 'error',
            message: step.error.reason,
            ...step.error.location,
          });
          break;
      }
    }
    return this.#events;
  }

  #start(id: number, program: Program): void {
    this.#running.set(id, { program, lastActionSucceeded: true });
  }

  #emit(robot: number, event: EventBody): void {
    this.#events.push({ tick: this.#tick, robot, ...event });
  }

  // Aplica a ação e devolve se deu certo
  #apply(id: number, action: Action): boolean {
    switch (action.kind) {
      case 'forward':
      case 'backward':
      case 'stepRight':
      case 'stepLeft':
        return this.#move(id, MOVES[action.kind]);
      case 'turnRight':
      case 'turnLeft': {
        const robot = this.fleet.move(id, Command.parse(TURNS[action.kind]));
        this.#emit(id, {
          kind: 'turned',
          position: robot.position,
          orientation: robot.orientation,
        });
        return true;
      }
      case 'wait':
        this.#emit(id, { kind: 'waited' });
        return true;
      case 'shareMap':
        return this.#share(id, action.to);
      case 'forgetMap':
        this.#emit(id, {
          kind: 'forgot',
          forgotten: this.fleet.robot(id).forgetMap(),
        });
        return true;
    }
  }

  // RN04/RN09/RN15: um passo, validado como antes; se não dá, o robô fica onde está
  #move(id: number, letter: string): boolean {
    try {
      const robot = this.fleet.move(id, Command.parse(letter));
      this.#emit(id, {
        kind: 'moved',
        position: robot.position,
        orientation: robot.orientation,
      });
      return true;
    } catch (error) {
      if (error instanceof OutOfGridError) {
        this.#block(id, 'edge', error.position, null);
      } else if (error instanceof ObstacleError) {
        this.#block(id, 'obstacle', error.position, null);
      } else if (error instanceof CollisionError) {
        this.#block(id, 'robot', error.position, error.robotId);
      } else {
        throw error;
      }
      return false;
    }
  }

  #block(
    id: number,
    reason: BlockReason,
    at: Position,
    other: number | null,
  ): void {
    this.#emit(id, { kind: 'blocked', reason, at, other });
  }

  // RN16
  #share(id: number, to: number): boolean {
    if (to === id) {
      this.#emit(id, { kind: 'shareFailed', to, reason: 'self' });
      return false;
    }
    try {
      const added = this.fleet.shareMap(id, to);
      this.#emit(id, { kind: 'shared', to, added });
      return true;
    } catch (error) {
      if (error instanceof NotAdjacentError) {
        this.#emit(id, { kind: 'shareFailed', to, reason: 'notAdjacent' });
      } else if (error instanceof UnknownRobotError) {
        this.#emit(id, { kind: 'shareFailed', to, reason: 'unknownRobot' });
      } else {
        throw error;
      }
      return false;
    }
  }
}

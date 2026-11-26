import { Fleet } from '../entities/Fleet.js';
import type { Robot, RobotSettings, RobotSnapshot } from '../entities/Robot.js';
import { CollisionError } from '../errors/CollisionError.js';
import { NotAdjacentError } from '../errors/NotAdjacentError.js';
import { ObstacleError } from '../errors/ObstacleError.js';
import { OutOfGridError } from '../errors/OutOfGridError.js';
import { UnknownRobotError } from '../errors/UnknownRobotError.js';
import type { Action } from '../script/host.js';
import { ScriptProcess } from '../script/interpreter.js';
import { ScriptSyntaxError } from '../script/ScriptError.js';
import type { Random } from '../services/random.js';
import { Command } from '../value-objects/Command.js';
import { step } from '../value-objects/Direction.js';
import { toAbsolute, type Orientation } from '../value-objects/Orientation.js';
import type { Position } from '../value-objects/Position.js';
import type { ItemKind } from '../world/Item.js';
import {
  purchaseUpgrade,
  type UpgradeCheck,
} from '../world/purchaseUpgrade.js';
import type { UpgradeKind } from '../world/Upgrade.js';
import { World, type WorldSnapshot } from '../world/World.js';
import { FleetRobotHost } from './FleetRobotHost.js';
import { OrderProgram, type Program } from './Program.js';

export type ProgramKind = Program['kind'];

export type BlockReason = 'edge' | 'obstacle' | 'robot';

export type ShareFailure = 'notAdjacent' | 'unknownRobot' | 'self';

export type ActionKind = Action['kind'];

// Por que uma ação (que não é andar nem compartilhar) não deu certo
export type FailReason =
  // RN24: carga insuficiente para a ação
  | 'noBattery'
  // RN23: só dá para fazer na base
  | 'notAtBase'
  // RN25/RN27: nada para pegar ou minerar
  | 'nothing'
  // RN25: não cabe no compartimento ou no armazém
  | 'full'
  // RN25: compartimento vazio
  | 'empty'
  // RN27: falta a picareta
  | 'noTool'
  // RN28
  | 'maxLevel'
  | 'missing';

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
  // RN24
  | { kind: 'recharged'; added: number; battery: number }
  // RN25
  | { kind: 'collected'; item: ItemKind }
  | { kind: 'unloaded'; count: number }
  // RN27
  | { kind: 'mined'; item: ItemKind; at: Position; depleted: boolean }
  // RN28
  | { kind: 'upgraded'; upgrade: UpgradeKind; level: number }
  | { kind: 'failed'; action: ActionKind; reason: FailReason }
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

// RN24: carga gasta por ação (as que não aparecem não gastam)
export const ACTION_COSTS: Readonly<Partial<Record<ActionKind, number>>> = {
  forward: 1,
  backward: 1,
  stepRight: 1,
  stepLeft: 1,
  shareMap: 1,
  collect: 1,
  mine: 3,
};

interface Running {
  program: Program;
  lastActionSucceeded: boolean;
  // RN30: o texto do script, para salvar
  source: string | null;
}

// RN30: tudo o que é preciso para continuar a simulação depois
export interface SimulationSnapshot {
  version: 1;
  tick: number;
  seed: number | null;
  world: WorldSnapshot;
  robotSettings: RobotSettings;
  robots: RobotSnapshot[];
  // Scripts que estavam rodando: recomeçam do início ao carregar
  scripts: { robot: number; source: string }[];
}

// RN17: o relógio. A cada tick, cada robô com programa executa no máximo 1 ação,
// em ordem de ID; depois o mundo anda (RN26, RN27) e os robôs atualizam a visão.
// Sensores e contas do script não gastam tick.
export class Simulation {
  readonly fleet: Fleet;
  // A semente que gerou o mundo (null se não se sabe)
  readonly seed: number | null;
  readonly #running = new Map<number, Running>();
  #tick = 0;
  #events: SimulationEvent[] = [];

  constructor(fleet: Fleet, { seed = null }: { seed?: number | null } = {}) {
    this.fleet = fleet;
    this.seed = seed;
  }

  // RN30: volta ao estado salvo. Scripts com erro de sintaxe ficam de fora.
  static restore(snapshot: SimulationSnapshot, random: Random): Simulation {
    const world = World.restore(snapshot.world, random);
    const fleet = Fleet.restore(world, snapshot.robots, snapshot.robotSettings);
    const simulation = new Simulation(fleet, { seed: snapshot.seed });
    simulation.#tick = snapshot.tick;
    for (const { robot, source } of snapshot.scripts) {
      try {
        simulation.loadScript(robot, source);
      } catch (error) {
        if (!(error instanceof ScriptSyntaxError)) {
          throw error;
        }
      }
    }
    return simulation;
  }

  snapshot(): SimulationSnapshot {
    const [first] = this.fleet.robots;
    return {
      version: 1,
      tick: this.#tick,
      seed: this.seed,
      world: this.world.snapshot(),
      robotSettings: (first as Robot).settings,
      robots: this.fleet.robots.map((robot) => robot.snapshot()),
      scripts: this.running.flatMap((robot) => {
        const source = this.#running.get(robot)?.source ?? null;
        return source === null ? [] : [{ robot, source }];
      }),
    };
  }

  get world(): World {
    return this.fleet.world;
  }

  // Quantos ticks já passaram
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
    this.#start(
      id,
      {
        kind: 'script',
        next: (lastActionSucceeded) => process.next(lastActionSucceeded),
      },
      source,
    );
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
    this.#start(id, new OrderProgram(actions), null);
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

  // RN28: o operador faz uma melhoria, fora dos ticks
  upgrade(id: number, kind: UpgradeKind): UpgradeCheck {
    return purchaseUpgrade(this.world, this.fleet.robot(id), kind);
  }

  // RN17: avança 1 tick e devolve o que aconteceu com os robôs
  advance(): SimulationEvent[] {
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
    // RN26, RN27: o mundo anda; nada cresce em cima de um robô
    this.world.advance(
      (position) => this.fleet.robotAt(position) !== undefined,
    );
    for (const robot of this.fleet.robots) {
      robot.endTick();
      robot.refreshView();
    }
    return this.#events;
  }

  #start(id: number, program: Program, source: string | null): void {
    this.#running.set(id, { program, lastActionSucceeded: true, source });
  }

  #emit(robot: number, event: EventBody): void {
    this.#events.push({ tick: this.#tick, robot, ...event });
  }

  // RN24: confere a carga, aplica a ação e só cobra se ela deu certo
  #apply(id: number, action: Action): boolean {
    const robot = this.fleet.robot(id);
    let cost = ACTION_COSTS[action.kind] ?? 0;
    if (action.kind in MOVES && robot.terrain.movementCost !== undefined) {
      const destination = step(robot.position, toAbsolute(robot.orientation, MOVES[action.kind as keyof typeof MOVES]));
      cost = robot.terrain.movementCost(destination);
    }
    if (!robot.canAfford(cost)) {
      this.#fail(id, action.kind, 'noBattery');
      return false;
    }
    const succeeded = this.#perform(id, robot, action);
    if (succeeded) {
      robot.spend(cost);
    }
    return succeeded;
  }

  #perform(id: number, robot: Robot, action: Action): boolean {
    switch (action.kind) {
      case 'forward':
      case 'backward':
      case 'stepRight':
      case 'stepLeft':
        return this.#move(id, MOVES[action.kind]);
      case 'turnRight':
      case 'turnLeft': {
        const turned = this.fleet.move(id, Command.parse(TURNS[action.kind]));
        this.#emit(id, {
          kind: 'turned',
          position: turned.position,
          orientation: turned.orientation,
        });
        return true;
      }
      case 'wait':
        this.#emit(id, { kind: 'waited' });
        return true;
      case 'shareMap':
        return this.#share(id, action.to);
      case 'forgetMap':
        this.#emit(id, { kind: 'forgot', forgotten: robot.forgetMap() });
        return true;
      case 'recharge':
        return this.#recharge(id, robot);
      case 'collect':
        return this.#collect(id, robot);
      case 'unload':
        return this.#unload(id, robot);
      case 'mine':
        return this.#mine(id, robot);
      case 'upgrade': {
        const result = purchaseUpgrade(this.world, robot, action.upgrade);
        if (!result.ok) {
          return this.#fail(id, 'upgrade', result.reason);
        }
        this.#emit(id, {
          kind: 'upgraded',
          upgrade: action.upgrade,
          level: result.level,
        });
        return true;
      }
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

  // Emite a falha e devolve false, para encerrar a ação numa linha
  #fail(id: number, action: ActionKind, reason: FailReason): false {
    this.#emit(id, { kind: 'failed', action, reason });
    return false;
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

  // RN24
  #recharge(id: number, robot: Robot): boolean {
    if (!this.world.isBase(robot.position)) {
      return this.#fail(id, 'recharge', 'notAtBase');
    }
    const added = robot.recharge();
    this.#emit(id, { kind: 'recharged', added, battery: robot.battery });
    return true;
  }

  // RN25: pega o item da casa onde o robô está
  #collect(id: number, robot: Robot): boolean {
    const item = this.world.itemAt(robot.position);
    if (item === null) {
      return this.#fail(id, 'collect', 'nothing');
    }
    if (!robot.cargo.fits(item)) {
      return this.#fail(id, 'collect', 'full');
    }
    this.world.takeItem(robot.position);
    robot.cargo.add(item);
    robot.refreshView();
    this.#emit(id, { kind: 'collected', item });
    return true;
  }

  // RN25: passa para o armazém tudo o que couber; true se o compartimento esvaziou
  #unload(id: number, robot: Robot): boolean {
    if (!this.world.isBase(robot.position)) {
      return this.#fail(id, 'unload', 'notAtBase');
    }
    if (robot.cargo.isEmpty) {
      return this.#fail(id, 'unload', 'empty');
    }
    const count = robot.cargo.transferTo(this.world.warehouse);
    if (count === 0) {
      return this.#fail(id, 'unload', 'full');
    }
    this.#emit(id, { kind: 'unloaded', count });
    return robot.cargo.isEmpty;
  }

  // RN27: minera a jazida da frente; o minério vai direto para o compartimento
  #mine(id: number, robot: Robot): boolean {
    if (!robot.hasPickaxe) {
      return this.#fail(id, 'mine', 'noTool');
    }
    const front = step(robot.position, toAbsolute(robot.orientation, 'N'));
    if (!this.world.isOre(front)) {
      return this.#fail(id, 'mine', 'nothing');
    }
    if (!robot.cargo.fits('iron')) {
      return this.#fail(id, 'mine', 'full');
    }
    const result = this.world.mine(front);
    if (result === null) {
      return this.#fail(id, 'mine', 'nothing');
    }
    robot.cargo.add(result.item);
    robot.refreshView();
    this.#emit(id, {
      kind: 'mined',
      item: result.item,
      at: front,
      depleted: result.depleted,
    });
    return true;
  }
}

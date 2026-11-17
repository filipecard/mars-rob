import { describe, expect, it } from 'vitest';
import {
  Fleet,
  MAX_ROBOTS,
  startingPositions,
} from '../../../../src/domain/entities/Fleet.js';
import { CollisionError } from '../../../../src/domain/errors/CollisionError.js';
import { NotAdjacentError } from '../../../../src/domain/errors/NotAdjacentError.js';
import { ObstacleError } from '../../../../src/domain/errors/ObstacleError.js';
import { UnknownRobotError } from '../../../../src/domain/errors/UnknownRobotError.js';
import { Command } from '../../../../src/domain/value-objects/Command.js';
import { Grid } from '../../../../src/domain/value-objects/Grid.js';
import { Obstacle } from '../../../../src/domain/value-objects/Obstacle.js';
import { Position } from '../../../../src/domain/value-objects/Position.js';

const at = (x: number, y: number): Position => Position.create(x, y);
const coords = ({ x, y }: Position): [number, number] => [x, y];

describe('Fleet', () => {
  const grid = Grid.square(3);

  describe('criação — RN13', () => {
    it('nasce na origem e depois nos cantos: sup. esq., sup. dir., inf. esq., inf. dir.', () => {
      expect(startingPositions(grid).map(coords)).toEqual([
        [0, 0],
        [-3, 3],
        [3, 3],
        [-3, -3],
        [3, -3],
      ]);
    });

    it('cria os robôs com IDs de 1 a N, olhando para o Norte', () => {
      const fleet = Fleet.create(grid, 3);

      expect(fleet.ids).toEqual([1, 2, 3]);
      expect(fleet.ids.map((id) => coords(fleet.robot(id).position))).toEqual([
        [0, 0],
        [-3, 3],
        [3, 3],
      ]);
      expect(fleet.ids.map((id) => fleet.robot(id).orientation)).toEqual([
        'N',
        'N',
        'N',
      ]);
    });

    it(`aceita até ${String(MAX_ROBOTS)} robôs`, () => {
      expect(Fleet.create(grid, MAX_ROBOTS).ids).toHaveLength(MAX_ROBOTS);
    });

    it.each([0, MAX_ROBOTS + 1, 1.5])('rejeita %s robôs', (count) => {
      expect(() => Fleet.create(grid, count)).toThrow(RangeError);
    });

    it('não aceita dois robôs na mesma posição', () => {
      expect(() =>
        Fleet.place(grid, [{ position: at(0, 0) }, { position: at(0, 0) }]),
      ).toThrow(RangeError);
    });

    it('não aceita frota vazia', () => {
      expect(() => Fleet.place(grid, [])).toThrow(RangeError);
    });

    it('não aceita robô em cima de obstáculo', () => {
      const blocked = Grid.square(3, [Obstacle.create([at(1, 1)])]);

      expect(() => Fleet.place(blocked, [{ position: at(1, 1) }])).toThrow(
        ObstacleError,
      );
    });

    it('cada robô começa com o próprio mapa — RN12', () => {
      const fleet = Fleet.create(grid, 2);

      expect(fleet.robot(1).hasExplored(at(0, 0))).toBe(true);
      expect(fleet.robot(1).hasExplored(at(-3, 3))).toBe(false);
      expect(fleet.robot(2).hasExplored(at(-3, 3))).toBe(true);
      expect(fleet.robot(2).hasExplored(at(0, 0))).toBe(false);
    });
  });

  it('robô inexistente — RN14', () => {
    const fleet = Fleet.create(grid, 2);

    expect(() => fleet.robot(3)).toThrow(UnknownRobotError);
    expect(() => fleet.move(9, Command.parse('N'))).toThrow(UnknownRobotError);
  });

  it('move só o robô indicado', () => {
    const fleet = Fleet.create(grid, 2);

    fleet.move(2, Command.parse('DN'));

    expect(coords(fleet.robot(1).position)).toEqual([0, 0]);
    expect(coords(fleet.robot(2).position)).toEqual([-2, 3]);
  });

  describe('colisão — RN15', () => {
    const twoInColumn = (): Fleet =>
      Fleet.place(grid, [{ position: at(0, 0) }, { position: at(0, 2) }]);

    it('não para na casa de outro robô', () => {
      const fleet = twoInColumn();

      expect(() => {
        fleet.move(1, Command.parse('NN'));
      }).toThrow(CollisionError);
      expect(coords(fleet.robot(1).position)).toEqual([0, 0]);
    });

    it('não atravessa outro robô', () => {
      const fleet = twoInColumn();

      expect(() => {
        fleet.move(1, Command.parse('NNN'));
      }).toThrow(CollisionError);
    });

    it('informa qual robô e onde', () => {
      const fleet = twoInColumn();

      try {
        fleet.move(1, Command.parse('NN'));
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(CollisionError);
        expect((error as CollisionError).robotId).toBe(2);
        expect(coords((error as CollisionError).position)).toEqual([0, 2]);
      }
    });

    it('a casa fica livre quando o outro robô sai', () => {
      const fleet = twoInColumn();

      fleet.move(2, Command.parse('L'));
      fleet.move(1, Command.parse('NN'));

      expect(coords(fleet.robot(1).position)).toEqual([0, 2]);
    });
  });

  describe('compartilhar mapa — RN16', () => {
    it('o robô ao lado recebe as casas que não conhecia', () => {
      // 1 em (0,0) e 2 em (1,0): os 3x3 se sobrepõem em 6 casas
      const fleet = Fleet.place(grid, [
        { position: at(0, 0) },
        { position: at(1, 0) },
      ]);

      expect(fleet.shareMap(1, 2)).toBe(3);
      expect(fleet.robot(2).hasExplored(at(-1, 0))).toBe(true);
      // Só o receptor muda
      expect(fleet.robot(1).hasExplored(at(2, 0))).toBe(false);
    });

    it('compartilhar de novo não acrescenta nada', () => {
      const fleet = Fleet.place(grid, [
        { position: at(0, 0) },
        { position: at(0, 1) },
      ]);
      fleet.shareMap(1, 2);

      expect(fleet.shareMap(1, 2)).toBe(0);
    });

    it.each([
      ['na diagonal', at(1, 1)],
      ['longe', at(0, 2)],
    ])('rejeita robô %s', (_name, position) => {
      const fleet = Fleet.place(grid, [{ position: at(0, 0) }, { position }]);

      expect(() => fleet.shareMap(1, 2)).toThrow(NotAdjacentError);
    });

    it('rejeita robô inexistente', () => {
      const fleet = Fleet.create(grid, 1);

      expect(() => fleet.shareMap(1, 2)).toThrow(UnknownRobotError);
    });
  });
});

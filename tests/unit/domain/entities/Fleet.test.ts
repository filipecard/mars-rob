import { describe, expect, it } from 'vitest';
import {
  Fleet,
  maxRobots,
  startingPositions,
  type Placement,
} from '../../../../src/domain/entities/Fleet.js';
import { CollisionError } from '../../../../src/domain/errors/CollisionError.js';
import { NotAdjacentError } from '../../../../src/domain/errors/NotAdjacentError.js';
import { ObstacleError } from '../../../../src/domain/errors/ObstacleError.js';
import { UnknownRobotError } from '../../../../src/domain/errors/UnknownRobotError.js';
import { generateGrid } from '../../../../src/domain/services/generateGrid.js';
import { Command } from '../../../../src/domain/value-objects/Command.js';
import { Grid } from '../../../../src/domain/value-objects/Grid.js';
import { Obstacle } from '../../../../src/domain/value-objects/Obstacle.js';
import { Position } from '../../../../src/domain/value-objects/Position.js';
import { seededRandom } from '../../../../src/infrastructure/random/seededRandom.js';

const at = (x: number, y: number): Position => Position.create(x, y);
const coords = ({ x, y }: Position): [number, number] => [x, y];

// Robô 1 na origem e robô 2 no canto (-3,3)
const pair: Placement[] = [{ position: at(0, 0) }, { position: at(-3, 3) }];

describe('maxRobots — RN13', () => {
  it.each([
    [1, 1],
    [2, 1],
    [3, 1],
    [5, 1],
    [6, 2],
    [15, 5],
    [17, 5],
    [18, 6],
    [21, 7],
  ])('malha de limite %i: no máximo %i robôs', (limit, expected) => {
    expect(maxRobots(limit)).toBe(expected);
  });
});

describe('startingPositions — RN13', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])(
    'semente %i: robô 1 na origem e os outros em casas livres, sem encostar em ninguém',
    (seed) => {
      const random = seededRandom(seed);
      const grid = generateGrid(21, { count: 8, maxSize: 6 }, random);

      const positions = startingPositions(grid, maxRobots(21), random);

      expect(positions).toHaveLength(7);
      expect(coords(positions[0] as Position)).toEqual([0, 0]);
      for (const [i, a] of positions.entries()) {
        expect(grid.contains(a) && !grid.isBlocked(a)).toBe(true);
        for (const b of positions.slice(i + 1)) {
          const far = Math.abs(a.x - b.x) > 1 || Math.abs(a.y - b.y) > 1;
          expect(far).toBe(true);
        }
      }
    },
  );

  it('a mesma semente gera as mesmas posições', () => {
    const grid = Grid.square(15);
    const first = startingPositions(grid, 5, seededRandom(7)).map(coords);
    const second = startingPositions(grid, 5, seededRandom(7)).map(coords);

    expect(first).toEqual(second);
  });

  it('falha quando não há espaço para os robôs', () => {
    expect(() => startingPositions(Grid.square(1), 2, seededRandom(1))).toThrow(
      RangeError,
    );
  });
});

describe('Fleet', () => {
  const grid = Grid.square(3);

  describe('criação — RN13', () => {
    it('cria os robôs com IDs de 1 a N, olhando para o Norte', () => {
      const fleet = Fleet.create(Grid.square(15), 5, seededRandom(3));

      expect(fleet.ids).toEqual([1, 2, 3, 4, 5]);
      expect(coords(fleet.robot(1).position)).toEqual([0, 0]);
      expect(fleet.ids.map((id) => fleet.robot(id).orientation)).toEqual([
        'N',
        'N',
        'N',
        'N',
        'N',
      ]);
    });

    it.each([
      [15, 6],
      [18, 7],
      [3, 2],
    ])('na malha de limite %i rejeita %i robôs', (limit, count) => {
      expect(() =>
        Fleet.create(Grid.square(limit), count, seededRandom(1)),
      ).toThrow(RangeError);
    });

    it.each([0, 1.5])('rejeita %s robôs', (count) => {
      expect(() => Fleet.create(grid, count, seededRandom(1))).toThrow(
        RangeError,
      );
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
      const fleet = Fleet.place(grid, pair);

      expect(fleet.robot(1).hasExplored(at(0, 0))).toBe(true);
      expect(fleet.robot(1).hasExplored(at(-3, 3))).toBe(false);
      expect(fleet.robot(2).hasExplored(at(-3, 3))).toBe(true);
      expect(fleet.robot(2).hasExplored(at(0, 0))).toBe(false);
    });
  });

  it('robô inexistente — RN14', () => {
    const fleet = Fleet.place(grid, pair);

    expect(() => fleet.robot(3)).toThrow(UnknownRobotError);
    expect(() => fleet.move(9, Command.parse('N'))).toThrow(UnknownRobotError);
  });

  it('move só o robô indicado', () => {
    const fleet = Fleet.place(grid, pair);

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
      const fleet = Fleet.create(grid, 1, seededRandom(1));

      expect(() => fleet.shareMap(1, 2)).toThrow(UnknownRobotError);
    });
  });
});

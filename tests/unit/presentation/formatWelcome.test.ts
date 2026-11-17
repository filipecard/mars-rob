import { describe, expect, it } from 'vitest';
import type { FleetDTO } from '../../../src/application/dto.js';
import { formatWelcome } from '../../../src/presentation/cli/formatWelcome.js';

const fleet: FleetDTO = {
  min: -2,
  max: 2,
  obstacleCount: 1,
  robots: [
    { id: 1, x: 0, y: 0, orientation: 'N' },
    { id: 2, x: -2, y: 2, orientation: 'N' },
  ],
};

describe('formatWelcome', () => {
  it('mostra a malha, a semente, os robôs e as ordens', () => {
    expect(formatWelcome(fleet, 42).split('\n')).toEqual([
      'Malha de -2 a 2 nos dois eixos, 1 obstáculo, 2 robôs (semente 42).',
      'Robô 1: posição atual (X: 0, Y: 0) para o Norte',
      'Robô 2: posição atual (X: -2, Y: 2) para o Norte',
      'Ordens (várias na mesma linha, separadas por espaço):',
      '  ID:COMANDOS  move um robô (passos N, S, L, O; giros D, E), ex.: 1:NNDE',
      '  DE>PARA      envia o mapa de um robô para outro que está ao lado, ex.: 1>2',
      '"mapa ID" mostra o mapa de um robô, "robos" lista os robôs e "sair" encerra.',
    ]);
  });

  it.each([
    [0, 1, '0 obstáculos, 1 robô'],
    [3, 2, '3 obstáculos, 2 robôs'],
  ])(
    'com %i obstáculos e %i robôs escreve "%s"',
    (obstacleCount, robots, text) => {
      const dto = {
        ...fleet,
        obstacleCount,
        robots: fleet.robots.slice(0, robots),
      };

      expect(formatWelcome(dto, 1).split('\n')[0]).toContain(text);
    },
  );
});

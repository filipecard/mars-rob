import { describe, expect, it } from 'vitest';
import type { GridDTO } from '../../../src/application/dto.js';
import { formatWelcome } from '../../../src/presentation/cli/formatWelcome.js';

const robot = { x: 0, y: 0, orientation: 'N' } as const;

describe('formatWelcome', () => {
  it('mostra a malha, a semente, o mapa explorado e os comandos', () => {
    const grid: GridDTO = {
      min: -2,
      max: 2,
      obstacleCount: 1,
      explored: [
        { x: 0, y: 0, blocked: false },
        { x: 1, y: 0, blocked: true },
      ],
      robot,
    };

    expect(formatWelcome(grid, 42).split('\n')).toEqual([
      'Malha de -2 a 2 nos dois eixos, 1 obstáculo (semente 42).',
      '? ? ? ? ?',
      '? ? ? ? ?',
      '? ? ^ # ?',
      '? ? ? ? ?',
      '? ? ? ? ?',
      'Explorado: 2 de 25 casas',
      'Legenda: ^ > v < robô (para onde olha)   # obstáculo   . livre   ? desconhecido',
      'Digite um comando (passos N, S, L, O; giros D, E), "mapa" para ver o mapa ou "sair" para encerrar.',
    ]);
  });

  it.each([
    [0, '0 obstáculos'],
    [3, '3 obstáculos'],
  ])('com %i obstáculos escreve "%s"', (count, text) => {
    const grid: GridDTO = {
      min: -15,
      max: 15,
      obstacleCount: count,
      explored: [],
      robot,
    };

    expect(formatWelcome(grid, 1).split('\n')[0]).toContain(text);
  });
});

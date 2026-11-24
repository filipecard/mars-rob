import { describe, expect, it } from 'vitest';
import type { FleetDTO } from '../../../src/application/dto.js';
import { formatWelcome } from '../../../src/presentation/cli/formatWelcome.js';

const fleet: FleetDTO = {
  min: -2,
  max: 2,
  obstacleCount: 1,
  robotCount: 2,
};

describe('formatWelcome', () => {
  it('mostra a malha, a semente, quantos robôs há (sem dizer onde) as ordens e os comandos', () => {
    expect(formatWelcome(fleet, 42).split('\n')).toEqual([
      'Malha de -2 a 2 nos dois eixos, 1 obstáculo, 2 robôs (semente 42).',
      'Ordens (várias na mesma linha, separadas por espaço; cada passo gasta 1 tick):',
      '  ID:COMANDOS  move um robô (passos N, S, L, O; giros D, E), ex.: 1:NNDE',
      '  DE>PARA      envia o mapa de um robô para outro que está ao lado, ex.: 1>2',
      'Comandos:',
      '  script ID    programa um robô; termine o script com uma linha "fim"',
      '  ticks N      avança N ticks (o mundo anda mesmo sem robô rodando)',
      '  parar ID     para o programa de um robô',
      '  mapa ID      mostra o mapa de um robô',
      '  estado ID    bateria, compartimento e melhorias do robô, e o armazém',
      '  melhorar ID M faz a melhoria M com o robô na base (picareta, bateria, compartimento, visao, armazem)',
      '  apagar ID    apaga o mapa de um robô',
      '  salvar NOME   salva a simulação; carregar NOME carrega; salvos lista',
      '  sair         encerra',
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
        robotCount: robots,
      };

      expect(formatWelcome(dto, 1).split('\n')[0]).toContain(text);
    },
  );
});

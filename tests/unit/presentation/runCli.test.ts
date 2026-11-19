import { describe, expect, it } from 'vitest';
import { AdvanceClock } from '../../../src/application/use-cases/AdvanceClock.js';
import { DescribeMap } from '../../../src/application/use-cases/DescribeMap.js';
import { DescribeSimulation } from '../../../src/application/use-cases/DescribeSimulation.js';
import { ExecuteOrders } from '../../../src/application/use-cases/ExecuteOrders.js';
import { LoadScript } from '../../../src/application/use-cases/LoadScript.js';
import { ForgetMap } from '../../../src/application/use-cases/ForgetMap.js';
import { StopProgram } from '../../../src/application/use-cases/StopProgram.js';
import { Fleet, type Placement } from '../../../src/domain/entities/Fleet.js';
import { Grid } from '../../../src/domain/value-objects/Grid.js';
import { Obstacle } from '../../../src/domain/value-objects/Obstacle.js';
import { Position } from '../../../src/domain/value-objects/Position.js';
import { InMemorySimulationRepository } from '../../../src/infrastructure/repositories/InMemorySimulationRepository.js';
import {
  CLI_MAX_TICKS,
  runCli,
  type CliMode,
} from '../../../src/presentation/cli/runCli.js';

const at = (x: number, y: number): Position => Position.create(x, y);

// Robô 1 na origem, 2 em (-3,3) e 3 em (3,3)
const starts = (count: number): Placement[] =>
  [at(0, 0), at(-3, 3), at(3, 3)]
    .slice(0, count)
    .map((position) => ({ position }));

async function run(
  lines: string[],
  fleet: Fleet = Fleet.create(Grid.standard(), 1, Math.random),
  prompts: CliMode[] = [],
): Promise<string[]> {
  const repository = InMemorySimulationRepository.of(fleet);
  const output: string[] = [];
  const useCases = {
    executeOrders: new ExecuteOrders(repository),
    describeMap: new DescribeMap(repository),
    describeSimulation: new DescribeSimulation(repository),
    loadScript: new LoadScript(repository),
    advanceClock: new AdvanceClock(repository),
    stopProgram: new StopProgram(repository),
    forgetMap: new ForgetMap(repository),
  };
  await runCli(useCases, toAsyncIterable(lines), {
    print: (text) => {
      output.push(text);
    },
    prompt: (mode) => {
      prompts.push(mode);
    },
  });
  return output;
}

async function* toAsyncIterable(lines: string[]): AsyncGenerator<string> {
  for (const line of lines) {
    await Promise.resolve();
    yield line;
  }
}

const LEGEND =
  'Legenda: ^ > v < robô 1 (para onde olha)   número outro robô   # obstáculo   . livre   ? desconhecido';

describe('runCli — ordens', () => {
  it('imprime a posição após cada ordem válida', async () => {
    expect(await run(['1:N', '1:LL'])).toEqual([
      'Robô 1: posição atual (X: 0, Y: 1) para o Norte',
      'Robô 1: posição atual (X: 2, Y: 1) para o Norte',
    ]);
  });

  it.each([
    ['1:D', 'Robô 1: posição atual (X: 0, Y: 0) para o Leste'],
    ['1:DD', 'Robô 1: posição atual (X: 0, Y: 0) para o Sul'],
    ['1:E', 'Robô 1: posição atual (X: 0, Y: 0) para o Oeste'],
  ])('imprime a orientação por extenso após "%s"', async (input, expected) => {
    expect(await run([input])).toEqual([expected]);
  });

  it('imprime o estado final de cada robô que recebeu ordem', async () => {
    expect(
      await run(['1:N 2:DN'], Fleet.place(Grid.square(3), starts(2))),
    ).toEqual([
      [
        'Robô 1: posição atual (X: 0, Y: 1) para o Norte',
        'Robô 2: posição atual (X: -2, Y: 3) para o Leste',
      ].join('\n'),
    ]);
  });

  it('imprime as mensagens de erro', async () => {
    expect(await run(['NN', '1:X', '7:N', '1>2'])).toEqual([
      'Ordem inválida "NN": use ID:COMANDOS (ex.: 1:NNDE) ou DE>PARA (ex.: 1>2)',
      'Comando inválido em "1:X", permitido apenas as letras (N,S,L,O,D,E)',
      'Não existe robô com ID 7',
      'Não existe robô com ID 2',
    ]);
  });

  it('erros de ordem aparecem antes do resultado das ordens aceitas', async () => {
    expect(await run(['1:X 1:N'])).toEqual([
      [
        'Comando inválido em "1:X", permitido apenas as letras (N,S,L,O,D,E)',
        'Robô 1: posição atual (X: 0, Y: 1) para o Norte',
      ].join('\n'),
    ]);
  });

  it('o robô para na borda', async () => {
    expect(await run([`1:${'N'.repeat(16)}`])).toEqual([
      [
        'Robô 1: não pode sair do limite da malha',
        'Robô 1: posição atual (X: 0, Y: 15) para o Norte',
      ].join('\n'),
    ]);
  });

  it('imprime onde está o obstáculo', async () => {
    const fleet = Fleet.create(
      Grid.square(15, [Obstacle.create([at(-1, 3)])]),
      1,
      Math.random,
    );

    expect(await run(['1:NNNO'], fleet)).toEqual([
      [
        'Robô 1: não pode passar pelo obstáculo em (X: -1, Y: 3)',
        'Robô 1: posição atual (X: 0, Y: 3) para o Norte',
      ].join('\n'),
    ]);
  });

  it('imprime a colisão com outro robô', async () => {
    const fleet = Fleet.place(Grid.square(3), [
      { position: at(0, 0) },
      { position: at(0, 1) },
    ]);

    expect(await run(['1:N'], fleet)).toEqual([
      [
        'Robô 1: não pode passar pelo robô 2 em (X: 0, Y: 1)',
        'Robô 1: posição atual (X: 0, Y: 0) para o Norte',
      ].join('\n'),
    ]);
  });

  it('imprime o compartilhamento de mapa', async () => {
    const fleet = Fleet.place(Grid.square(3), [
      { position: at(0, 0) },
      { position: at(1, 0) },
      { position: at(3, 3) },
    ]);

    const output = await run(['1>2', '2>1 2>1', '1>3'], fleet);

    expect(output.map((text) => text.split('\n')[0])).toEqual([
      'Robô 1 enviou o mapa para o robô 2: 3 casas novas',
      'Robô 2 enviou o mapa para o robô 1: 3 casas novas',
      'Os robôs 1 e 3 precisam estar lado a lado para compartilhar o mapa',
    ]);
    expect(output[1]?.split('\n')[1]).toBe(
      'Robô 2 enviou o mapa para o robô 1: nenhuma casa nova',
    );
  });

  it('linha vazia não imprime nada', async () => {
    expect(await run(['', '  '])).toEqual([]);
  });

  it('para de ler ao receber "sair"', async () => {
    expect(await run(['1:N', 'sair', '1:N'])).toEqual([
      'Robô 1: posição atual (X: 0, Y: 1) para o Norte',
    ]);
  });
});

describe('runCli — mapa', () => {
  it('"mapa 1" mostra o mapa do robô 1 com a legenda', async () => {
    const fleet = Fleet.create(
      Grid.square(1, [Obstacle.create([at(0, 1)])]),
      1,
      Math.random,
    );

    expect(await run(['1:D', 'mapa 1'], fleet)).toEqual([
      'Robô 1: posição atual (X: 0, Y: 0) para o Leste',
      [
        'Mapa do robô 1',
        '. # .',
        '. > .',
        '. . .',
        'Explorado: 9 de 9 casas',
        LEGEND,
      ].join('\n'),
    ]);
  });

  it('CA48 — "mapa 1" revela o caminho percorrido e mantém o resto desconhecido — RN12', async () => {
    const [, map] = await run(
      ['1:LL', 'mapa 1'],
      Fleet.create(Grid.square(3), 1, Math.random),
    );

    expect(map?.split('\n').slice(1, 9)).toEqual([
      '? ? ? ? ? ? ?',
      '? ? ? ? ? ? ?',
      '? ? . . . . .',
      '? ? . . . ^ .',
      '? ? . . . . .',
      '? ? ? ? ? ? ?',
      '? ? ? ? ? ? ?',
      'Explorado: 15 de 49 casas',
    ]);
  });

  it.each(['mapa', 'mapa x', 'mapa 0'])(
    '"%s" explica como usar o comando',
    async (input) => {
      expect(await run([input])).toEqual([
        'Use "mapa ID" para ver o mapa de um robô, ex.: mapa 1',
      ]);
    },
  );

  it('"mapa" de robô inexistente', async () => {
    expect(await run(['mapa 3'])).toEqual(['Não existe robô com ID 3']);
  });
});

describe('runCli — scripts e relógio — RN17, RN18', () => {
  it('CA70 — "script 1" recebe linhas até "fim" e roda o script', async () => {
    const prompts: CliMode[] = [];

    const output = await run(
      [
        'script 1',
        'for (let i = 0; i < 3; i++) {',
        '  forward()',
        '}',
        'print("andei", self.position)',
        'fim',
      ],
      undefined,
      prompts,
    );

    expect(output).toEqual([
      [
        'Robô 1 diz: andei (0, 3)',
        'Robô 1: posição atual (X: 0, Y: 3) para o Norte',
      ].join('\n'),
    ]);
    expect(prompts).toEqual([
      'script',
      'script',
      'script',
      'script',
      'script',
      'command',
    ]);
  });

  it('erro de sintaxe no script', async () => {
    expect(await run(['script 1', 'forward(', 'fim'])).toEqual([
      expect.stringMatching(/^Erro de sintaxe na linha 1, coluna \d+: /),
    ]);
  });

  it('erro de execução no script', async () => {
    expect(await run(['script 1', 'forward()', 'x = 1', 'fim'])).toEqual([
      [
        'Robô 1: erro no script na linha 2, coluna 1: "x" não foi declarado (use let x = ...)',
        'Robô 1: posição atual (X: 0, Y: 1) para o Norte',
      ].join('\n'),
    ]);
  });

  it('"sair" dentro do script é só uma linha do script', async () => {
    expect(await run(['script 1', 'sair', 'fim'])).toEqual([
      expect.stringContaining('"sair" não foi declarado'),
    ]);
  });

  it.each(['script', 'script x', 'script 1 2'])(
    '"%s" explica como usar o comando',
    async (input) => {
      expect(await run([input])).toEqual([
        'Use "script ID", escreva o script e termine com uma linha "fim"',
      ]);
    },
  );

  it('script de robô inexistente', async () => {
    expect(await run(['script 4', 'wait()', 'fim'])).toEqual([
      'Não existe robô com ID 4',
    ]);
  });

  it(`um script sem fim para depois de ${String(CLI_MAX_TICKS)} ticks e continua com "ticks N"`, async () => {
    const output = await run([
      'script 1',
      'while (true) { turnRight() }',
      'fim',
      'ticks 2',
      'parar 1',
      'ticks 5',
    ]);

    expect(output).toEqual([
      [
        'Robô 1: posição atual (X: 0, Y: 0) para o Norte',
        'Ainda rodando: robô 1. Use "ticks N" para avançar ou "parar ID" para parar.',
      ].join('\n'),
      [
        'Robô 1: posição atual (X: 0, Y: 0) para o Sul',
        'Ainda rodando: robô 1. Use "ticks N" para avançar ou "parar ID" para parar.',
      ].join('\n'),
      'Robô 1: programa parado',
      'Nenhum robô está rodando programa',
    ]);
  });

  it('"parar" sem programa, de robô inexistente e sem ID', async () => {
    expect(await run(['parar 1', 'parar 9', 'parar'])).toEqual([
      'Robô 1: não estava rodando nenhum programa',
      'Não existe robô com ID 9',
      'Use "parar ID" para parar o programa de um robô, ex.: parar 1',
    ]);
  });

  it('CA75 — "apagar 1" apaga o mapa do robô — RN20', async () => {
    const output = await run(['1:NNN', 'apagar 1', 'mapa 1']);

    expect(output[1]).toBe('Robô 1 apagou o mapa: 9 casas esquecidas');
    expect(output[2]).toContain('Explorado: 9 de 961 casas');
  });

  it('CA76 — apagar o mapa de um robô não muda o dos outros — RN20', async () => {
    const fleet = Fleet.place(Grid.standard(), [
      { position: at(0, 0) },
      { position: at(1, 0) },
    ]);
    const output = await run(['1>2', 'apagar 1', 'apagar 2'], fleet);

    expect(output[1]).toBe('Robô 1 apagou o mapa: nenhuma casa esquecida');
    expect(output[2]).toBe('Robô 2 apagou o mapa: 3 casas esquecidas');
  });

  it('CA78 — "apagar" de robô inexistente e sem ID', async () => {
    expect(await run(['apagar 9', 'apagar'])).toEqual([
      'Não existe robô com ID 9',
      'Use "apagar ID" para apagar o mapa de um robô, ex.: apagar 1',
    ]);
  });

  it.each(['ticks', 'ticks 0', 'ticks x'])(
    '"%s" explica como usar o comando',
    async (input) => {
      expect(await run([input])).toEqual([
        'Use "ticks N" para avançar até N ticks, ex.: ticks 10',
      ]);
    },
  );
});

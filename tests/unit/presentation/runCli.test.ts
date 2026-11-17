import { describe, expect, it } from 'vitest';
import { DescribeFleet } from '../../../src/application/use-cases/DescribeFleet.js';
import { DescribeMap } from '../../../src/application/use-cases/DescribeMap.js';
import { ExecuteOrders } from '../../../src/application/use-cases/ExecuteOrders.js';
import { Fleet, type Placement } from '../../../src/domain/entities/Fleet.js';
import { Grid } from '../../../src/domain/value-objects/Grid.js';
import { Obstacle } from '../../../src/domain/value-objects/Obstacle.js';
import { Position } from '../../../src/domain/value-objects/Position.js';
import { InMemoryFleetRepository } from '../../../src/infrastructure/repositories/InMemoryFleetRepository.js';
import { runCli } from '../../../src/presentation/cli/runCli.js';

const at = (x: number, y: number): Position => Position.create(x, y);

// Robô 1 na origem, 2 em (-3,3) e 3 em (3,3)
const starts = (count: number): Placement[] =>
  [at(0, 0), at(-3, 3), at(3, 3)]
    .slice(0, count)
    .map((position) => ({ position }));

async function run(
  lines: string[],
  fleet: Fleet = Fleet.create(Grid.standard(), 1, Math.random),
): Promise<string[]> {
  const repository = new InMemoryFleetRepository(fleet);
  const output: string[] = [];
  const useCases = {
    executeOrders: new ExecuteOrders(repository),
    describeFleet: new DescribeFleet(repository),
    describeMap: new DescribeMap(repository),
  };
  await runCli(useCases, toAsyncIterable(lines), (text) => output.push(text));
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

describe('runCli', () => {
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

  it('imprime uma linha por ordem', async () => {
    expect(await run(['1:N 2:DN'], Fleet.place(Grid.square(3), starts(2)))).toEqual([
      [
        'Robô 1: posição atual (X: 0, Y: 1) para o Norte',
        'Robô 2: posição atual (X: -2, Y: 3) para o Leste',
      ].join('\n'),
    ]);
  });

  it('imprime as mensagens de erro', async () => {
    expect(
      await run(['NN', '1:X', '7:N', `1:${'N'.repeat(16)}`, '1>2']),
    ).toEqual([
      'Ordem inválida "NN": use ID:COMANDOS (ex.: 1:NNDE) ou DE>PARA (ex.: 1>2)',
      'Comando inválido em "1:X", permitido apenas as letras (N,S,L,O,D,E)',
      'Não existe robô com ID 7',
      'Robô 1: não pode sair do limite da malha',
      'Não existe robô com ID 2',
    ]);
  });

  it('imprime onde está o obstáculo', async () => {
    const fleet = Fleet.create(
      Grid.square(15, [Obstacle.create([at(-1, 3)])]), 1, Math.random);

    expect(await run(['1:NNNO'], fleet)).toEqual([
      'Robô 1: não pode passar pelo obstáculo em (X: -1, Y: 3)',
    ]);
  });

  it('imprime a colisão com outro robô', async () => {
    const fleet = Fleet.place(Grid.square(3), [
      { position: at(0, 0) },
      { position: at(0, 1) },
    ]);

    expect(await run(['1:N'], fleet)).toEqual([
      'Robô 1: não pode passar pelo robô 2 em (X: 0, Y: 1)',
    ]);
  });

  it('imprime o compartilhamento de mapa', async () => {
    const fleet = Fleet.place(Grid.square(3), [
      { position: at(0, 0) },
      { position: at(1, 0) },
      { position: at(3, 3) },
    ]);

    expect(await run(['1>2', '2>1 2>1', '1>3'], fleet)).toEqual([
      'Robô 1 enviou o mapa para o robô 2: 3 casas novas',
      [
        'Robô 2 enviou o mapa para o robô 1: 3 casas novas',
        'Robô 2 enviou o mapa para o robô 1: nenhuma casa nova',
      ].join('\n'),
      'Os robôs 1 e 3 precisam estar lado a lado para compartilhar o mapa',
    ]);
  });

  it('linha vazia não imprime nada', async () => {
    expect(await run(['', '  '])).toEqual([]);
  });

  it('para de ler ao receber "sair"', async () => {
    expect(await run(['1:N', 'sair', '1:N'])).toEqual([
      'Robô 1: posição atual (X: 0, Y: 1) para o Norte',
    ]);
  });

  it('"robos" lista todos os robôs', async () => {
    expect(await run(['robos'], Fleet.place(Grid.square(3), starts(2)))).toEqual([
      [
        'Robô 1: posição atual (X: 0, Y: 0) para o Norte',
        'Robô 2: posição atual (X: -3, Y: 3) para o Norte',
      ].join('\n'),
    ]);
  });

  it('"mapa 1" mostra o mapa do robô 1 com a legenda', async () => {
    const fleet = Fleet.create(
      Grid.square(1, [Obstacle.create([at(0, 1)])]), 1, Math.random);

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

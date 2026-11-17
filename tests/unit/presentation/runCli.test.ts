import { describe, expect, it } from 'vitest';
import { DescribeGrid } from '../../../src/application/use-cases/DescribeGrid.js';
import { MoveRobot } from '../../../src/application/use-cases/MoveRobot.js';
import { InMemoryRobotRepository } from '../../../src/infrastructure/repositories/InMemoryRobotRepository.js';
import { Robot } from '../../../src/domain/entities/Robot.js';
import { Grid } from '../../../src/domain/value-objects/Grid.js';
import { Obstacle } from '../../../src/domain/value-objects/Obstacle.js';
import { Position } from '../../../src/domain/value-objects/Position.js';
import { runCli } from '../../../src/presentation/cli/runCli.js';

async function run(
  lines: string[],
  repository = new InMemoryRobotRepository(),
): Promise<string[]> {
  const output: string[] = [];
  const useCases = {
    moveRobot: new MoveRobot(repository),
    describeGrid: new DescribeGrid(repository),
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

describe('runCli', () => {
  it('imprime a posição após cada comando válido', async () => {
    expect(await run(['N', 'LL'])).toEqual([
      'Posição atual (X: 0, Y: 1) para o Norte',
      'Posição atual (X: 2, Y: 1) para o Norte',
    ]);
  });

  it.each([
    ['D', 'Posição atual (X: 0, Y: 0) para o Leste'],
    ['DD', 'Posição atual (X: 0, Y: 0) para o Sul'],
    ['E', 'Posição atual (X: 0, Y: 0) para o Oeste'],
  ])('imprime a orientação por extenso após "%s"', async (input, expected) => {
    expect(await run([input])).toEqual([expected]);
  });

  it('imprime as mensagens de erro', async () => {
    expect(await run(['X', 'N'.repeat(16)])).toEqual([
      'Tipo de entrada inválido, permitido apenas as letras (N,S,L,O,D,E)',
      'O robô não pode sair do limite da malha',
    ]);
  });

  it('para de ler ao receber "sair"', async () => {
    expect(await run(['N', 'sair', 'N'])).toEqual([
      'Posição atual (X: 0, Y: 1) para o Norte',
    ]);
  });

  it('imprime onde está o obstáculo', async () => {
    const repository = new InMemoryRobotRepository(
      Robot.create(
        Grid.square(15, [Obstacle.create([Position.create(-1, 3)])]),
      ),
    );

    expect(await run(['NNNO'], repository)).toEqual([
      'O robô não pode passar pelo obstáculo em (X: -1, Y: 3)',
    ]);
  });

  it('"mapa" mostra o mapa com o robô e a legenda', async () => {
    const repository = new InMemoryRobotRepository(
      Robot.create(Grid.square(1, [Obstacle.create([Position.create(0, 1)])])),
    );

    expect(await run(['D', 'mapa'], repository)).toEqual([
      'Posição atual (X: 0, Y: 0) para o Leste',
      [
        '. # .',
        '. > .',
        '. . .',
        'Explorado: 9 de 9 casas',
        'Legenda: ^ > v < robô (para onde olha)   # obstáculo   . livre   ? desconhecido',
      ].join('\n'),
    ]);
  });

  it('"mapa" revela o caminho percorrido e mantém o resto desconhecido — RN12', async () => {
    const repository = new InMemoryRobotRepository(
      Robot.create(Grid.square(3)),
    );

    const [, map] = await run(['LL', 'mapa'], repository);

    expect(map?.split('\n').slice(0, 8)).toEqual([
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
});

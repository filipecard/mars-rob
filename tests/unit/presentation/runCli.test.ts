import { describe, expect, it } from 'vitest';
import { MoveRobot } from '../../../src/application/use-cases/MoveRobot.js';
import { InMemoryRobotRepository } from '../../../src/infrastructure/repositories/InMemoryRobotRepository.js';
import { runCli } from '../../../src/presentation/cli/runCli.js';

async function run(lines: string[]): Promise<string[]> {
  const output: string[] = [];
  const moveRobot = new MoveRobot(new InMemoryRobotRepository());
  await runCli(moveRobot, toAsyncIterable(lines), (text) => output.push(text));
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
});

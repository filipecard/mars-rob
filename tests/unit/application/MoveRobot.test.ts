import { beforeEach, describe, expect, it } from 'vitest';
import { MoveRobot } from '../../../src/application/use-cases/MoveRobot.js';
import { InMemoryRobotRepository } from '../../../src/infrastructure/repositories/InMemoryRobotRepository.js';

// Critérios de aceite de docs/requisitos.md, seção 6
describe('MoveRobot — critérios de aceite', () => {
  let moveRobot: MoveRobot;

  beforeEach(() => {
    moveRobot = new MoveRobot(new InMemoryRobotRepository());
  });

  it.each([
    ['CA01', 'N', 0, 1],
    ['CA02', 'S', 0, -1],
    ['CA03', 'L', 1, 0],
    ['CA04', 'O', -1, 0],
    ['CA05', 'NLLSSSS', 2, -3],
    ['CA06', 'NSLO', 0, 0],
    ['CA07', 'N'.repeat(15), 0, 15],
    ['CA08', 'S'.repeat(15) + 'O'.repeat(15), -15, -15],
    ['CA13', '', 0, 0],
  ])('%s — "%s" leva a (%i,%i)', async (_ca, input, x, y) => {
    expect(await moveRobot.execute(input)).toEqual({
      ok: true,
      robot: { x, y, orientation: 'N' },
    });
  });

  it.each([
    ['CA09', 'N'.repeat(16)],
    ['CA10', 'N'.repeat(16) + 'S'],
  ])(
    '%s — sair da malha é rejeitado e o robô fica em (0,0)',
    async (_ca, input) => {
      expect(await moveRobot.execute(input)).toEqual({
        ok: false,
        error: 'OUT_OF_GRID',
        robot: { x: 0, y: 0, orientation: 'N' },
      });
    },
  );

  it('CA11 — a posição persiste entre comandos', async () => {
    await moveRobot.execute('N');

    expect(await moveRobot.execute('L')).toEqual({
      ok: true,
      robot: { x: 1, y: 1, orientation: 'N' },
    });
  });

  it('CA12 — comando rejeitado mantém a posição do comando anterior', async () => {
    await moveRobot.execute('N');

    expect(await moveRobot.execute('S'.repeat(17))).toEqual({
      ok: false,
      error: 'OUT_OF_GRID',
      robot: { x: 0, y: 1, orientation: 'N' },
    });
    expect(await moveRobot.execute('')).toEqual({
      ok: true,
      robot: { x: 0, y: 1, orientation: 'N' },
    });
  });

  it.each([
    ['CA14', 'n'],
    ['CA15', 'N L'],
    ['CA16', '1N'],
    ['CA17', 'NXN'],
    ['CA28', 'd'],
  ])('%s — "%s" é entrada inválida', async (_ca, input) => {
    expect(await moveRobot.execute(input)).toEqual({
      ok: false,
      error: 'INVALID_COMMAND',
      robot: { x: 0, y: 0, orientation: 'N' },
    });
  });

  it.each([
    ['CA18', 'D', 0, 0, 'L'],
    ['CA19', 'E', 0, 0, 'O'],
    ['CA20', 'DDDD', 0, 0, 'N'],
    ['CA21', 'DN', 1, 0, 'L'],
    ['CA22', 'DDN', 0, -1, 'S'],
    ['CA23', 'DDS', 0, 1, 'S'],
    ['CA24', 'DL', 0, -1, 'L'],
    ['CA25', 'EN', -1, 0, 'O'],
  ])(
    '%s — "%s" leva a (%i,%i) olhando para %s',
    async (_ca, input, x, y, orientation) => {
      expect(await moveRobot.execute(input)).toEqual({
        ok: true,
        robot: { x, y, orientation },
      });
    },
  );

  it('CA26 — comando rejeitado mantém posição e orientação', async () => {
    expect(await moveRobot.execute('D' + 'N'.repeat(16))).toEqual({
      ok: false,
      error: 'OUT_OF_GRID',
      robot: { x: 0, y: 0, orientation: 'N' },
    });
  });

  it('CA27 — a orientação persiste entre comandos', async () => {
    await moveRobot.execute('D');

    expect(await moveRobot.execute('N')).toEqual({
      ok: true,
      robot: { x: 1, y: 0, orientation: 'L' },
    });
  });
});

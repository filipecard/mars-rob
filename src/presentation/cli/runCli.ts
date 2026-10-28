import type { MoveRobot } from '../../application/use-cases/MoveRobot.js';
import { formatResult } from './formatResult.js';

export const EXIT_COMMAND = 'sair';

export async function runCli(
  moveRobot: MoveRobot,
  lines: AsyncIterable<string>,
  print: (text: string) => void,
): Promise<void> {
  for await (const line of lines) {
    if (line === EXIT_COMMAND) {
      return;
    }
    print(formatResult(await moveRobot.execute(line)));
  }
}

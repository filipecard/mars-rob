import type { DescribeGrid } from '../../application/use-cases/DescribeGrid.js';
import type { MoveRobot } from '../../application/use-cases/MoveRobot.js';
import { formatMap, MAP_LEGEND } from './formatMap.js';
import { formatResult } from './formatResult.js';

export const EXIT_COMMAND = 'sair';
export const MAP_COMMAND = 'mapa';

export interface CliUseCases {
  moveRobot: MoveRobot;
  describeGrid: DescribeGrid;
}

export async function runCli(
  { moveRobot, describeGrid }: CliUseCases,
  lines: AsyncIterable<string>,
  print: (text: string) => void,
): Promise<void> {
  for await (const line of lines) {
    if (line === EXIT_COMMAND) {
      return;
    }
    if (line === MAP_COMMAND) {
      print(`${formatMap(await describeGrid.execute())}\n${MAP_LEGEND}`);
      continue;
    }
    print(formatResult(await moveRobot.execute(line)));
  }
}

import type { DescribeFleet } from '../../application/use-cases/DescribeFleet.js';
import type { DescribeMap } from '../../application/use-cases/DescribeMap.js';
import type { ExecuteOrders } from '../../application/use-cases/ExecuteOrders.js';
import { formatMapView } from './formatMap.js';
import { formatOrderResult } from './formatResult.js';

export const EXIT_COMMAND = 'sair';
export const MAP_COMMAND = 'mapa';

export const MAP_USAGE = `Use "${MAP_COMMAND} ID" para ver o mapa de um robô, ex.: ${MAP_COMMAND} 1`;

const MAP_PATTERN = new RegExp(`^${MAP_COMMAND}(?:\\s+(.*))?$`);
const ID_PATTERN = /^[1-9]\d*$/;

export interface CliUseCases {
  executeOrders: ExecuteOrders;
  describeFleet: DescribeFleet;
  describeMap: DescribeMap;
}

export async function runCli(
  useCases: CliUseCases,
  lines: AsyncIterable<string>,
  print: (text: string) => void,
): Promise<void> {
  for await (const line of lines) {
    if (line === EXIT_COMMAND) {
      return;
    }
    const output = await respond(useCases, line);
    if (output !== '') {
      print(output);
    }
  }
}

async function respond(
  { executeOrders, describeMap }: CliUseCases,
  line: string,
): Promise<string> {
  const map = MAP_PATTERN.exec(line);
  if (map !== null) {
    const id = map[1]?.trim() ?? '';
    if (!ID_PATTERN.test(id)) {
      return MAP_USAGE;
    }
    const result = await describeMap.execute(Number(id));
    return result.ok
      ? formatMapView(result.map)
      : `Não existe robô com ID ${String(result.robotId)}`;
  }
  // Linha vazia: nenhuma ordem, nada a mostrar
  const results = await executeOrders.execute(line);
  return results.map(formatOrderResult).join('\n');
}

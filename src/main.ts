import process, { argv, stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline';
import { DescribeFleet } from './application/use-cases/DescribeFleet.js';
import { DescribeMap } from './application/use-cases/DescribeMap.js';
import { ExecuteOrders } from './application/use-cases/ExecuteOrders.js';
import { Fleet } from './domain/entities/Fleet.js';
import { generateGrid } from './domain/services/generateGrid.js';
import { loadConfig } from './infrastructure/config/AppConfig.js';
import {
  randomSeed,
  seededRandom,
} from './infrastructure/random/seededRandom.js';
import { InMemoryFleetRepository } from './infrastructure/repositories/InMemoryFleetRepository.js';
import { formatWelcome } from './presentation/cli/formatWelcome.js';
import { parseCliArgs } from './presentation/cli/parseCliArgs.js';
import { runCli } from './presentation/cli/runCli.js';

// Composition root: único lugar que conhece todas as camadas
function exitWithError(message: string): never {
  console.error(message);
  process.exit(1);
}

const args = parseCliArgs(argv.slice(2));
if (!args.ok) {
  exitWithError(args.message);
}
const loaded = await loadConfig(args.args.configPath);
if (!loaded.ok) {
  exitWithError(loaded.message);
}
const { config } = loaded;

// Sem semente no arquivo, sorteia uma e mostra na tela para o mapa poder ser repetido
const seed = config.seed ?? randomSeed();
let fleet: Fleet;
try {
  // A mesma semente sorteia os obstáculos e depois onde os robôs nascem
  const random = seededRandom(seed);
  fleet = Fleet.create(
    generateGrid(config.limit, config.obstacles, random),
    config.robots,
    random,
  );
} catch (error) {
  exitWithError(`Configuração inválida: ${(error as Error).message}`);
}

const repository = new InMemoryFleetRepository(fleet);
const useCases = {
  executeOrders: new ExecuteOrders(repository),
  describeFleet: new DescribeFleet(repository),
  describeMap: new DescribeMap(repository),
};
const rl = createInterface({ input: stdin, output: stdout, prompt: '> ' });

console.log(formatWelcome(await useCases.describeFleet.execute(), seed));
rl.prompt();
await runCli(useCases, rl, (text) => {
  console.log(text);
  rl.prompt();
});
rl.close();

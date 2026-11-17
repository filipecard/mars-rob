import process, { argv, stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline';
import { DescribeGrid } from './application/use-cases/DescribeGrid.js';
import { MoveRobot } from './application/use-cases/MoveRobot.js';
import { Robot } from './domain/entities/Robot.js';
import { generateGrid } from './domain/services/generateGrid.js';
import { loadConfig } from './infrastructure/config/AppConfig.js';
import {
  randomSeed,
  seededRandom,
} from './infrastructure/random/seededRandom.js';
import { InMemoryRobotRepository } from './infrastructure/repositories/InMemoryRobotRepository.js';
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
let robot: Robot;
try {
  robot = Robot.create(
    generateGrid(config.limit, config.obstacles, seededRandom(seed)),
  );
} catch (error) {
  exitWithError(`Configuração inválida: ${(error as Error).message}`);
}

const repository = new InMemoryRobotRepository(robot);
const useCases = {
  moveRobot: new MoveRobot(repository),
  describeGrid: new DescribeGrid(repository),
};
const rl = createInterface({ input: stdin, output: stdout, prompt: '> ' });

console.log(formatWelcome(await useCases.describeGrid.execute(), seed));
rl.prompt();
await runCli(useCases, rl, (text) => {
  console.log(text);
  rl.prompt();
});
rl.close();

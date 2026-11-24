import { existsSync } from 'node:fs';
import process, { argv, stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { AdvanceClock } from './application/use-cases/AdvanceClock.js';
import { DescribeFleet } from './application/use-cases/DescribeFleet.js';
import { DescribeMap } from './application/use-cases/DescribeMap.js';
import { DescribeSimulation } from './application/use-cases/DescribeSimulation.js';
import { ExecuteOrders } from './application/use-cases/ExecuteOrders.js';
import { LoadScript } from './application/use-cases/LoadScript.js';
import { ForgetMap } from './application/use-cases/ForgetMap.js';
import {
  ListSaves,
  LoadGame,
  SaveGame,
} from './application/use-cases/SaveGame.js';
import { StopProgram } from './application/use-cases/StopProgram.js';
import { UpgradeRobot } from './application/use-cases/UpgradeRobot.js';
import { Fleet } from './domain/entities/Fleet.js';
import { Simulation } from './domain/simulation/Simulation.js';
import { generateGrid } from './domain/services/generateGrid.js';
import { World } from './domain/world/World.js';
import { loadConfig } from './infrastructure/config/AppConfig.js';
import {
  randomSeed,
  seededRandom,
} from './infrastructure/random/seededRandom.js';
import { InMemorySimulationRepository } from './infrastructure/repositories/InMemorySimulationRepository.js';
import { JsonFileSaveStore } from './infrastructure/saves/JsonFileSaveStore.js';
import { formatWelcome } from './presentation/cli/formatWelcome.js';
import { parseCliArgs } from './presentation/cli/parseCliArgs.js';
import { runCli } from './presentation/cli/runCli.js';
import { SimulationController } from './presentation/http/SimulationController.js';
import { startServer } from './presentation/http/startServer.js';

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
  // A mesma semente sorteia as rochas, o mundo (pedras, árvores, jazidas) e onde os
  // robôs nascem; depois continua sorteando o que nasce no mundo a cada tick
  const random = seededRandom(seed);
  const world = World.create(
    generateGrid(config.limit, config.obstacles, random),
    config.world,
    random,
  );
  fleet = Fleet.create(world, config.robots, random, config.robot);
} catch (error) {
  exitWithError(`Configuração inválida: ${(error as Error).message}`);
}

const repository = new InMemorySimulationRepository(
  new Simulation(fleet, { seed }),
);
const saves = new JsonFileSaveStore();
const useCases = {
  executeOrders: new ExecuteOrders(repository),
  describeFleet: new DescribeFleet(repository),
  describeMap: new DescribeMap(repository),
  describeSimulation: new DescribeSimulation(repository),
  loadScript: new LoadScript(repository),
  advanceClock: new AdvanceClock(repository),
  stopProgram: new StopProgram(repository),
  forgetMap: new ForgetMap(repository),
  upgradeRobot: new UpgradeRobot(repository),
  saveGame: new SaveGame(repository, saves),
  loadGame: new LoadGame(repository, saves, seededRandom),
  listSaves: new ListSaves(saves),
};

const welcome = formatWelcome(await useCases.describeFleet.execute(), seed);

if (args.args.server) {
  // Interface web: API + WebSocket; serve o frontend compilado, se existir (npm run web:build)
  const webDist = fileURLToPath(new URL('../web/dist/', import.meta.url));
  // Só a 1ª linha (malha e semente): os comandos da CLI não valem aqui
  console.log(welcome.split('\n')[0]);
  const running = await startServer(new SimulationController(useCases), {
    port: args.args.port,
    ...(existsSync(webDist) ? { staticDir: webDist } : {}),
  });
  console.log(
    `Servidor em http://localhost:${String(running.port)} (Ctrl+C encerra)`,
  );
} else {
  console.log(welcome);
  const rl = createInterface({ input: stdin, output: stdout, prompt: '> ' });
  rl.prompt();
  await runCli(useCases, rl, {
    print: (text) => {
      console.log(text);
    },
    prompt: (mode) => {
      rl.setPrompt(mode === 'script' ? '... ' : '> ');
      rl.prompt();
    },
  });
  rl.close();
}

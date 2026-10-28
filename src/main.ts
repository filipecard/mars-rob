import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline';
import { MoveRobot } from './application/use-cases/MoveRobot.js';
import { InMemoryRobotRepository } from './infrastructure/repositories/InMemoryRobotRepository.js';
import { EXIT_COMMAND, runCli } from './presentation/cli/runCli.js';

// Composition root: único lugar que conhece todas as camadas
const moveRobot = new MoveRobot(new InMemoryRobotRepository());
const rl = createInterface({ input: stdin, output: stdout, prompt: '> ' });

console.log(
    `Digite um comando (N, S, L, O) ou "${EXIT_COMMAND}" para encerrar.`,
);
rl.prompt();
await runCli(moveRobot, rl, (text) => {
    console.log(text);
    rl.prompt();
});
rl.close();

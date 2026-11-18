# Plano — robôs programáveis, ticks e frontend

Decisões já tomadas:

- Os scripts são escritos numa linguagem própria, com palavras-chave em inglês e sintaxe de JavaScript/C (chaves).
- A primeira versão tem o básico mais funções do usuário. Classes do usuário ficam para uma 2ª etapa.
- A aplicação passa a ter um relógio (ticks). A cada tick, cada robô com programa ativo executa **uma ação**, em ordem de ID.
- As ordens diretas (`1:NN`) viram um programa curto que anda 1 passo por tick. A atomicidade da RN05 deixa de valer: o robô para no passo que falhar.
- O frontend consome uma API Node com WebSocket e é feito em React + Vite.
- Testes da interface: só os automatizados de lógica (vitest). A parte visual e os cliques o usuário testa manualmente.

## Fase 1 — Linguagem (interpretador)

Fica em `src/domain/script/`, sem depender de mais nada:
lexer → parser → AST → interpretador.

O interpretador usa generators: a execução **pausa a cada ação** e continua no tick seguinte.

Rascunho da linguagem:

```js
// comentários de linha e /* de bloco */
let passos = 0;
while (type(front()) == 'empty' && passos < 10) {
  forward();
  passos += 1;
}

function virarAte(lado) {
  while (type(front()) != 'empty') {
    if (lado == 'right') {
      turnRight();
    } else {
      turnLeft();
    }
  }
}

for (let i = 0; i < 4; i++) {
  turnLeft();
}
for (let cell of see()) {
  if (type(cell) == 'robot') {
    print('achei o robô', cell.robot);
  }
}
```

- **Valores:** números, textos, `true` / `false`, `null`, listas (`[1, 2]`, `lista[i]`, `.length`, `.push()`, `.pop()`, `.shift()`) e objetos nativos (casa, posição).
- **Comandos:** `let`, atribuição (`=`, `+=`, `-=`, `++`, `--`), `if` / `else if` / `else`, `while`, `for (;;)`, `for (let x of lista)`, `break`, `continue`, `function`, `return`. O ponto e vírgula é opcional.
- **Operadores:** `+ - * / %`, `== != < <= > >=`, `&& || !`.
- **Ações (gastam 1 tick e devolvem `true` se deram certo):** `forward()`, `backward()`, `stepRight()`, `stepLeft()`, `turnRight()`, `turnLeft()`, `wait()`, `shareMap(id)`. Além delas, `stop()` encerra o programa.
- **Sensores (não gastam tick):**
  - `front()`, `back()`, `left()` e `right()` devolvem a casa vizinha.
  - `see()` devolve as casas da visão 3x3.
  - `cellAt(x, y)` devolve uma casa do mapa do próprio robô (`"unknown"` se ele ainda não a viu).
  - `self` (`id`, `position`, `orientation`).
  - `explored()` diz quantas casas o robô conhece.
- **Casa:** `type` (`"empty"`, `"obstacle"`, `"robot"`, `"edge"`, `"unknown"`), `isEmpty`, `position`, `robot` (ID, se houver robô nela).
- **Funções nativas:** `type(x)` devolve o tipo da casa ou o tipo do valor (`"number"`, `"string"`, `"list"`...). Também há `print(...)`, `abs`, `min`, `max` e `floor`.
- **Proteções:** existe um limite de operações sem nenhuma ação dentro de um tick, para que `while (true) {}` não trave o relógio. Os erros de sintaxe e de execução informam linha e coluna.

## Fase 2 — Simulação com ticks

- `Simulation` (domínio): a frota, o programa de cada robô, `tick()` e os eventos do tick (andou, bateu, compartilhou, terminou, erro, print).
- Ordens `ID:COMANDOS` são compiladas para um programa (`N` → `if (!forward()) stop()` ...).
- Casos de uso: carregar programa, avançar N ticks, estado da simulação.
- CLI: depois de cada linha, roda os ticks até todos os programas pararem (com limite). Um comando novo recebe scripts de várias linhas.

## Fase 3 — API + WebSocket

- Novo adaptador `src/presentation/http/` (servidor Node), ligado no composition root.
- Rotas:
  - `GET /state`
  - `POST /robots/:id/program`
  - `POST /clock/play`, `/clock/pause` e `/clock/step`
  - `PUT /clock/speed`
- O WebSocket envia o estado e os eventos a cada tick.

## Fase 4 — Frontend (React + Vite, pasta `web/`)

- O mapa de cada robô, lado a lado, desenhado a partir do DTO do mapa.
- Um editor de script por robô, mostrando os erros com linha e coluna.
- Os controles do relógio (play, pause, avançar 1 tick e velocidade) e um painel de eventos e `print`.
- Testes só de lógica (vitest). O teste visual é manual.

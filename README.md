# Mars Rob

[![CI](https://github.com/filipecard/mars-rob/actions/workflows/ci.yml/badge.svg)](https://github.com/filipecard/mars-rob/actions/workflows/ci.yml)

Robôs programáveis numa malha quadrada, com obstáculos sorteados e mapa escuro: cada robô
só conhece o que já viu, e os robôs podem trocar mapas entre si. Eles recebem ordens de texto
ou rodam scripts numa linguagem própria, e andam juntos no ritmo de um relógio (ticks).
Dá para usar pela linha de comando ou por uma interface web.
É um projeto de estudo de **TypeScript**, **Clean Architecture** e **TDD**.

## Como rodar

Requer Node.js 24 (veja `.nvmrc`).

```bash
npm install
npm run dev          # linha de comando
```

Interface web (mapa e script de cada robô, relógio e diário dos eventos):

```bash
npm run web:install  # dependências do frontend (pasta web/)
npm run serve        # API + WebSocket em http://localhost:3000
npm run web:dev      # em outro terminal: frontend em http://localhost:5173
```

Ou, numa porta só: `npm run web:build` e depois `npm run serve` (o servidor entrega o
frontend compilado em http://localhost:3000). Outra porta: `npm run dev -- --servidor --porta 8080`.

## Configuração

Tudo fica em `mars-rob.config.json` (para usar outro arquivo: `npm run dev -- --config outro.json`):

```json
{
  "limite": 15,
  "robos": 3,
  "obstaculos": { "quantidade": 4, "tamanhoMaximo": 4 },
  "semente": null
}
```

| Chave                      | O que faz                                                            | Padrão |
| -------------------------- | -------------------------------------------------------------------- | ------ |
| `limite`                   | a malha vai de `-limite` a `limite` nos dois eixos                   | `15`   |
| `robos`                    | quantos robôs: de 1 até limite ÷ 3 (limite 15: 5; 18: 6; 21: 7)      | `1`    |
| `obstaculos.quantidade`    | quantos obstáculos sortear                                           | `4`    |
| `obstaculos.tamanhoMaximo` | cada obstáculo tem de 1 até este número de casas                     | `4`    |
| `semente`                  | `null` sorteia um mapa novo a cada execução; um número repete o mapa | `null` |

Os obstáculos são sorteados ao iniciar, com formatos variados (reta, L, T, Z, quadrado...).
O sorteio garante que eles **nunca bloqueiam o caminho**: a origem e os cantos ficam livres e
o robô sempre consegue chegar a qualquer casa livre, inclusive aos 4 lados da malha.
A semente usada aparece na tela; coloque-a em `"semente"` para repetir o mesmo mapa.

## Comandos

Os robôs têm IDs 1, 2, 3... O robô 1 nasce na origem (0,0); os outros nascem em casas livres
sorteadas (com a mesma semente do mapa), sem encostar em outro robô. Todos começam olhando para o Norte.
A tela inicial só diz quantos robôs há; para saber onde um robô está, use `mapa ID` ou a ordem vazia `ID:`.

Cada linha digitada tem uma ou mais **ordens**, separadas por espaço. Cada ordem entra na fila do seu robô:

| Ordem         | Efeito                                                         | Exemplo  |
| ------------- | -------------------------------------------------------------- | -------- |
| `ID:COMANDOS` | o robô `ID` executa os comandos                                | `1:NNDE` |
| `DE>PARA`     | o robô `DE` envia o mapa dele para o robô `PARA` (lado a lado) | `1>2`    |

Exemplo: `1:NN 2:DE 1>2` move o robô 1 e gira o robô 2 ao mesmo tempo; depois o 1 envia o mapa para o 2.
Cada letra (e cada envio de mapa) gasta **1 tick**, e todos os robôs agem no mesmo tick, em ordem de ID.
Se um passo bateria na borda, num obstáculo ou em outro robô, o robô para ali e o resto daquela ordem
é descartado; os passos já dados continuam valendo, e as outras ordens seguem normalmente.

Letras dos comandos:

| Letra | Efeito                   |
| ----- | ------------------------ |
| `N`   | um passo para a frente   |
| `S`   | um passo para trás       |
| `L`   | um passo para a direita  |
| `O`   | um passo para a esquerda |
| `D`   | gira 90° para a direita  |
| `E`   | gira 90° para a esquerda |

Exemplo: `1:DNNE` gira o robô 1 para o Leste, anda 2 casas e volta a olhar para o Norte.

Comandos do sistema:

| Comando     | Efeito                                                                 |
| ----------- | ---------------------------------------------------------------------- |
| `mapa ID`   | mostra o mapa do robô `ID`                                             |
| `script ID` | as próximas linhas são um script para o robô `ID`, até uma linha `fim` |
| `ticks N`   | avança até N ticks (para scripts que ainda estão rodando)              |
| `parar ID`  | para o programa do robô `ID`                                           |
| `sair`      | encerra o programa                                                     |

Depois de cada linha de ordens ou de um script, a CLI roda os ticks até todos os robôs pararem
(no máximo 1000) e mostra o que aconteceu e onde cada robô ficou.

## Scripts dos robôs

Os scripts usam uma linguagem parecida com JavaScript, com laços, condições, funções e sensores.
A referência completa está em [docs/linguagem.md](docs/linguagem.md). Exemplo na CLI (a saída depende do mapa sorteado):

```
> script 1
... while (front().isEmpty) {
...   forward()
... }
... print('parei diante de', type(front()))
... fim
Robô 1 diz: parei diante de obstacle
Robô 1: posição atual (X: 0, Y: 4) para o Norte
```

O mapa começa **escuro** e **cada robô tem o seu**: ele só enxerga a casa onde está e 1 casa em volta
(inclusive diagonais), e o mapa dele revela apenas o que ele já viu pelo caminho. Quando dois robôs estão
lado a lado (vizinhos pelos lados, sem diagonal), um pode enviar o mapa para o outro com `DE>PARA`; para
trocar nos dois sentidos, use `1>2 2>1`. No mapa, `^ > v <` é o dono do mapa (para onde ele olha), um número
é outro robô (só aparece enquanto estiver na visão; nenhum robô sabe onde o outro está até encontrá-lo), `#` é obstáculo, `.` é casa livre e `?` é desconhecido.

Outras ideias para evoluir o projeto estão em [docs/ideias.md](docs/ideias.md).

As regras completas e os critérios de aceite estão em [docs/requisitos.md](docs/requisitos.md).

## Arquitetura

```
src/
├── domain/          # regras de negócio puras
│   ├── entities/    #   Fleet e Robot
│   ├── script/      #   a linguagem: lexer, parser e interpretador (pausa a cada ação)
│   ├── simulation/  #   Simulation (relógio), programas de ordens e sensores do script
│   └── ...          #   Grid, Obstacle, Position, Command, Order, gerador de obstáculos
├── application/     # casos de uso (ExecuteOrders, LoadScript, AdvanceClock, StopProgram, Describe*),
│                    # DTOs e a porta SimulationRepository
├── infrastructure/  # repositório em memória, arquivo de configuração e sorteio com semente
├── presentation/
│   ├── cli/         #   argumentos, laço de comandos, mapa e formatação da saída
│   └── http/        #   API HTTP, WebSocket e o relógio da interface web
└── main.ts          # composition root: o único lugar que liga todas as camadas
web/                 # frontend React + Vite (usa os tipos dos DTOs do backend)
```

As dependências apontam para dentro. O `eslint-plugin-boundaries` garante isso: a
apresentação, por exemplo, não pode importar o domínio, e o domínio não importa nada de fora.

## Scripts

| Script                  | O que faz                                                      |
| ----------------------- | -------------------------------------------------------------- |
| `npm run dev`           | roda o CLI direto do TypeScript                                |
| `npm run serve`         | sobe a API + WebSocket da interface web                        |
| `npm run web:dev`       | frontend em modo desenvolvimento (Vite)                        |
| `npm run web:build`     | compila o frontend para `web/dist/`                            |
| `npm run web:test`      | testes de lógica do frontend                                   |
| `npm run build`         | compila para `dist/`                                           |
| `npm start`             | roda a versão compilada                                        |
| `npm test`              | roda os testes                                                 |
| `npm run test:coverage` | testes com cobertura (mínimo de 90%)                           |
| `npm run lint`          | ESLint (inclui as regras de camadas)                           |
| `npm run typecheck`     | checagem de tipos                                              |
| `npm run format`        | formata com Prettier                                           |
| `npm run check`         | tudo o que o CI roda: lint, tipos, formatação, testes e builds |

O CI (GitHub Actions) roda os mesmos passos do `npm run check` em cada push na `main` e em cada pull request.

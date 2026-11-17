# Mars Rob

[![CI](https://github.com/filipecard/mars-rob/actions/workflows/ci.yml/badge.svg)](https://github.com/filipecard/mars-rob/actions/workflows/ci.yml)

Até 5 robôs controlados por comandos de texto numa malha quadrada, com obstáculos sorteados
e mapa escuro: cada robô só conhece o que já viu, e os robôs podem trocar mapas entre si.
É um projeto de estudo de **TypeScript**, **Clean Architecture** e **TDD**.

## Como rodar

Requer Node.js 24 (veja `.nvmrc`).

```bash
npm install
npm run dev
```

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
| `robos`                    | quantos robôs (de 1 a 5)                                             | `1`    |
| `obstaculos.quantidade`    | quantos obstáculos sortear                                           | `4`    |
| `obstaculos.tamanhoMaximo` | cada obstáculo tem de 1 até este número de casas                     | `4`    |
| `semente`                  | `null` sorteia um mapa novo a cada execução; um número repete o mapa | `null` |

Os obstáculos são sorteados ao iniciar, com formatos variados (reta, L, T, Z, quadrado...).
O sorteio garante que eles **nunca bloqueiam o caminho**: a origem e os cantos ficam livres e
o robô sempre consegue chegar a qualquer casa livre, inclusive aos 4 lados da malha.
A semente usada aparece na tela; coloque-a em `"semente"` para repetir o mesmo mapa.

## Comandos

Os robôs têm IDs 1, 2, 3... e nascem, nessa ordem, na origem (0,0) e nos cantos: superior
esquerdo, superior direito, inferior esquerdo e inferior direito. Todos começam olhando para o Norte.

Cada linha digitada tem uma ou mais **ordens**, separadas por espaço, executadas da esquerda para a direita:

| Ordem         | Efeito                                                         | Exemplo  |
| ------------- | -------------------------------------------------------------- | -------- |
| `ID:COMANDOS` | o robô `ID` executa os comandos                                | `1:NNDE` |
| `DE>PARA`     | o robô `DE` envia o mapa dele para o robô `PARA` (lado a lado) | `1>2`    |

Exemplo: `1:NN 2:DE 1>2` move o robô 1, gira o robô 2 e depois o 1 envia o mapa para o 2.
Cada ordem é independente: se uma for rejeitada, as outras continuam valendo.

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

| Comando   | Efeito                     |
| --------- | -------------------------- |
| `mapa ID` | mostra o mapa do robô `ID` |
| `robos`   | mostra onde está cada robô |
| `sair`    | encerra o programa         |

O mapa começa **escuro** e **cada robô tem o seu**: ele só enxerga a casa onde está e 1 casa em volta
(inclusive diagonais), e o mapa dele revela apenas o que ele já viu pelo caminho. Quando dois robôs estão
lado a lado (vizinhos pelos lados, sem diagonal), um pode enviar o mapa para o outro com `DE>PARA`; para
trocar nos dois sentidos, use `1>2 2>1`. No mapa, `^ > v <` é o dono do mapa (para onde ele olha), um número
é outro robô (só aparece se estiver numa casa conhecida), `#` é obstáculo, `.` é casa livre e `?` é desconhecido.

O comando é atômico: se algum passo sair da malha, bater num obstáculo ou passar por outro robô, o comando
inteiro é rejeitado e o robô fica onde estava.

Outras ideias para evoluir o projeto estão em [docs/ideias.md](docs/ideias.md).

As regras completas e os critérios de aceite estão em [docs/requisitos.md](docs/requisitos.md).

## Arquitetura

```
src/
├── domain/          # regras de negócio puras (Fleet, Robot, Grid, Obstacle, Position, Command, Order, gerador de obstáculos)
├── application/     # casos de uso ExecuteOrders, DescribeFleet e DescribeMap, DTOs e a porta FleetRepository
├── infrastructure/  # repositório em memória, arquivo de configuração e sorteio com semente
├── presentation/    # CLI: argumentos, laço de comandos, mapa e formatação da saída
└── main.ts          # composition root: o único lugar que liga todas as camadas
```

As dependências apontam para dentro. O `eslint-plugin-boundaries` garante isso: a
apresentação, por exemplo, não pode importar o domínio, e o domínio não importa nada de fora.

## Scripts

| Script                  | O que faz                                                     |
| ----------------------- | ------------------------------------------------------------- |
| `npm run dev`           | roda o CLI direto do TypeScript                               |
| `npm run build`         | compila para `dist/`                                          |
| `npm start`             | roda a versão compilada                                       |
| `npm test`              | roda os testes                                                |
| `npm run test:coverage` | testes com cobertura (mínimo de 90%)                          |
| `npm run lint`          | ESLint (inclui as regras de camadas)                          |
| `npm run typecheck`     | checagem de tipos                                             |
| `npm run format`        | formata com Prettier                                          |
| `npm run check`         | tudo o que o CI roda: lint, tipos, formatação, testes e build |

O CI (GitHub Actions) roda os mesmos passos do `npm run check` em cada push na `main` e em cada pull request.

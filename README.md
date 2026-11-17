# Mars Rob

[![CI](https://github.com/filipecard/mars-rob/actions/workflows/ci.yml/badge.svg)](https://github.com/filipecard/mars-rob/actions/workflows/ci.yml)

Robô controlado por comandos de texto numa malha quadrada, com obstáculos sorteados.
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
  "obstaculos": { "quantidade": 4, "tamanhoMaximo": 4 },
  "semente": null
}
```

| Chave                      | O que faz                                                            | Padrão |
| -------------------------- | -------------------------------------------------------------------- | ------ |
| `limite`                   | a malha vai de `-limite` a `limite` nos dois eixos                   | `15`   |
| `obstaculos.quantidade`    | quantos obstáculos sortear                                           | `4`    |
| `obstaculos.tamanhoMaximo` | cada obstáculo tem de 1 até este número de casas                     | `4`    |
| `semente`                  | `null` sorteia um mapa novo a cada execução; um número repete o mapa | `null` |

Os obstáculos são sorteados ao iniciar, com formatos variados (reta, L, T, Z, quadrado...).
O sorteio garante que eles **nunca bloqueiam o caminho**: a origem e os cantos ficam livres e
o robô sempre consegue chegar a qualquer casa livre, inclusive aos 4 lados da malha.
A semente usada aparece na tela; coloque-a em `"semente"` para repetir o mesmo mapa.

## Comandos

O robô começa em (0,0), olhando para o Norte. Cada linha digitada é um comando:

| Letra  | Efeito                   |
| ------ | ------------------------ |
| `N`    | um passo para a frente   |
| `S`    | um passo para trás       |
| `L`    | um passo para a direita  |
| `O`    | um passo para a esquerda |
| `D`    | gira 90° para a direita  |
| `E`    | gira 90° para a esquerda |
| `mapa` | mostra o mapa            |
| `sair` | encerra o programa       |

Exemplo: `DNNE` gira para o Leste, anda 2 casas e volta a olhar para o Norte.

O mapa começa **escuro**: o robô só enxerga a casa onde está e 1 casa em volta (inclusive diagonais),
e o mapa revela apenas o que ele já viu pelo caminho. No mapa, `^ > v <` é o robô (para onde ele olha),
`#` é obstáculo, `.` é casa livre e `?` é desconhecido.

O comando é atômico: se algum passo sair da malha ou bater num obstáculo, o comando
inteiro é rejeitado e o robô fica onde estava.

As regras completas e os critérios de aceite estão em [docs/requisitos.md](docs/requisitos.md).

## Arquitetura

```
src/
├── domain/          # regras de negócio puras (Robot, Grid, Obstacle, Position, Command, gerador de obstáculos)
├── application/     # casos de uso MoveRobot e DescribeGrid, DTOs e a porta RobotRepository
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

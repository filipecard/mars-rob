# Requisitos — Mars Rob

## 1. Visão geral

Sistema de linha de comando que controla um robô numa malha quadrada. O operador
digita comandos de texto (sequências de direções) e o sistema responde com a nova
posição do robô ou com o motivo da rejeição.

## 2. Glossário

- **Malha (Grid):** área quadrada onde o robô se move, de -15 a 15 (inclusive) nos dois eixos — 31x31 posições, com a origem (0,0) no centro. Substitui os termos "região" e "planeta".
- **Posição (Position):** par de coordenadas inteiras (x, y) dentro da malha.
- **Direção (Direction):** uma das letras `N`, `S`, `L`, `O`. Cada direção equivale a um passo.
- **Movimento (Movement):** deslocamento de um passo numa direção.
- **Comando (Command):** a string inteira digitada pelo operador, ex.: `"NLLSSSS"`.

## 3. Regras de negócio

- **RN01** — Posição inicial: o robô começa em (0,0).
- **RN02** — Limites da malha: x e y vão de -15 a 15, inclusive.
- **RN03** — Cada letra é um passo: `N` = y+1; `S` = y-1; `L` = x+1; `O` = x-1.
- **RN04** — A validação de limite é feita a cada passo: o robô não pode atravessar a borda, nem que volte para dentro da malha depois.
- **RN05** — O comando é atômico: se qualquer passo sair da malha, o comando inteiro é rejeitado e o robô permanece onde estava.
- **RN06** — A posição persiste entre comandos: cada comando parte da posição deixada pelo anterior.
- **RN07** — Comando válido: apenas as letras `N`, `S`, `L`, `O`, maiúsculas, sem espaços. A entrada vazia (`""`) é válida e não move o robô.

## 4. Formato da entrada

- Formato: sequência de letras sem separador. Válidos: `N`, `NLL`, `NLSO`, `""`. Inválidos: `1X`, `L L`, `N1`, `XXX`, `n`.
- Quantidade de passos: sem limite, desde que o robô não saia da malha (RN04).
- Letras aceitas: `N`, `S`, `L`, `O`, somente maiúsculas.
- Espaços: não são aceitos, nem no início/fim.

## 5. Formato da saída

- Sucesso: `Posição atual (X: 2, Y: -3)`
- Erro de entrada inválida: `Tipo de entrada inválido, permitido apenas as letras (N,S,L,O)`
- Erro de limite da malha: `O robô não pode sair do limite da malha`

## 6. Critérios de aceite

Salvo indicação, o robô parte de (0,0).

| CA   | Regra      | Dado  | Quando               | Então                          |
| ---- | ---------- | ----- | -------------------- | ------------------------------ |
| CA01 | RN03       | (0,0) | `"N"`                | (0,1)                          |
| CA02 | RN03       | (0,0) | `"S"`                | (0,-1)                         |
| CA03 | RN03       | (0,0) | `"L"`                | (1,0)                          |
| CA04 | RN03       | (0,0) | `"O"`                | (-1,0)                         |
| CA05 | RN03       | (0,0) | `"NLLSSSS"`          | (2,-3)                         |
| CA06 | RN03       | (0,0) | `"NSLO"`             | (0,0)                          |
| CA07 | RN02       | (0,0) | 15× `N`              | (0,15)                         |
| CA08 | RN02       | (0,0) | 15× `S` + 15× `O`    | (-15,-15)                      |
| CA09 | RN04, RN05 | (0,0) | 16× `N`              | erro de limite; fica em (0,0)  |
| CA10 | RN04, RN05 | (0,0) | 16× `N` + `S`        | erro de limite; fica em (0,0)  |
| CA11 | RN06       | (0,0) | `"N"` e depois `"L"` | (1,1)                          |
| CA12 | RN05, RN06 | (0,1) | 17× `S`              | erro de limite; fica em (0,1)  |
| CA13 | RN07       | (0,0) | `""`                 | (0,0)                          |
| CA14 | RN07       | (0,0) | `"n"`                | erro de entrada; fica em (0,0) |
| CA15 | RN07       | (0,0) | `"N L"`              | erro de entrada; fica em (0,0) |
| CA16 | RN07       | (0,0) | `"1N"`               | erro de entrada; fica em (0,0) |
| CA17 | RN07       | (0,0) | `"NXN"`              | erro de entrada; fica em (0,0) |

## 7. Fora do escopo

- Orientação do robô (girar para esquerda/direita) — as letras são direções absolutas.
- Formato com quantidade de passos (`"1N2L"`).
- Múltiplos robôs e obstáculos na malha.
- Persistência da posição entre execuções do programa (fica só em memória).
- Tamanho de malha configurável.

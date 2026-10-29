# Requisitos — Mars Rob

## 1. Visão geral

Sistema de linha de comando que controla um robô numa malha quadrada. O operador
digita comandos de texto (sequências de passos e giros) e o sistema responde com a
nova posição e orientação do robô ou com o motivo da rejeição.

## 2. Glossário

- **Malha (Grid):** área quadrada onde o robô se move, de -15 a 15 (inclusive) nos dois eixos — 31x31 posições, com a origem (0,0) no centro. Substitui os termos "região" e "planeta". O norte da malha é fixo: y+1 é sempre Norte.
- **Posição (Position):** par de coordenadas inteiras (x, y) dentro da malha.
- **Orientação (Orientation):** para onde o robô está virado: `N`, `L`, `S` ou `O`, em relação ao norte da malha.
- **Direção (Direction):** uma das letras `N`, `S`, `L`, `O`. Cada uma é um passo relativo à orientação do robô: frente, trás, direita e esquerda.
- **Giro (Turn):** uma das letras `D` (direita) ou `E` (esquerda). Muda a orientação em 90° sem mudar a posição.
- **Instrução (Instruction):** uma direção ou um giro.
- **Comando (Command):** a string inteira digitada pelo operador, ex.: `"DNLLSESSS"`. As instruções são executadas na ordem em que foram digitadas.

## 3. Regras de negócio

- **RN01** — Estado inicial: o robô começa em (0,0), orientado para o Norte.
- **RN02** — Limites da malha: x e y vão de -15 a 15, inclusive.
- **RN03** — Cada direção é um passo relativo à orientação do robô: `N` = frente, `S` = trás, `L` = direita, `O` = esquerda. O deslocamento na malha depende da orientação: olhando para o Norte, `N` = y+1; olhando para o Sul, `N` = y-1.
- **RN04** — A validação de limite é feita a cada passo: o robô não pode atravessar a borda, nem que volte para dentro da malha depois.
- **RN05** — O comando é atômico: se qualquer passo sair da malha, o comando inteiro é rejeitado e o robô mantém a posição e a orientação que tinha antes do comando.
- **RN06** — O estado persiste entre comandos: cada comando parte da posição e da orientação deixadas pelo anterior.
- **RN07** — Comando válido: apenas as letras `N`, `S`, `L`, `O`, `D`, `E`, maiúsculas, sem espaços. A entrada vazia (`""`) é válida e não altera o robô.
- **RN08** — Giro: `D` gira 90° no sentido horário (N→L→S→O→N) e `E` gira 90° no anti-horário. O giro não muda a posição.

## 4. Formato da entrada

- Formato: sequência de letras sem separador. Válidos: `N`, `NLL`, `NLSO`, `DN`, `NE`, `NLSOED`, `""`. Inválidos: `1X`, `L L`, `N1`, `XXX`, `n`, `d`.
- Quantidade de passos: sem limite, desde que o robô não saia da malha (RN04).
- Letras aceitas: `N`, `S`, `L`, `O`, `D`, `E`, somente maiúsculas.
- Espaços: não são aceitos, nem no início/fim.

## 5. Formato da saída

- Sucesso: `Posição atual (X: 0, Y: -1) para o Sul` (orientação por extenso: Norte, Leste, Sul, Oeste)
- Erro de entrada inválida: `Tipo de entrada inválido, permitido apenas as letras (N,S,L,O,D,E)`
- Erro de limite da malha: `O robô não pode sair do limite da malha`

## 6. Critérios de aceite

Salvo indicação, o robô parte de (0,0) olhando para o Norte. Quando a orientação não é citada, ela continua N.

| CA   | Regra      | Dado  | Quando               | Então                                   |
| ---- | ---------- | ----- | -------------------- | --------------------------------------- |
| CA01 | RN03       | (0,0) | `"N"`                | (0,1)                                   |
| CA02 | RN03       | (0,0) | `"S"`                | (0,-1)                                  |
| CA03 | RN03       | (0,0) | `"L"`                | (1,0)                                   |
| CA04 | RN03       | (0,0) | `"O"`                | (-1,0)                                  |
| CA05 | RN03       | (0,0) | `"NLLSSSS"`          | (2,-3)                                  |
| CA06 | RN03       | (0,0) | `"NSLO"`             | (0,0)                                   |
| CA07 | RN02       | (0,0) | 15× `N`              | (0,15)                                  |
| CA08 | RN02       | (0,0) | 15× `S` + 15× `O`    | (-15,-15)                               |
| CA09 | RN04, RN05 | (0,0) | 16× `N`              | erro de limite; fica em (0,0)           |
| CA10 | RN04, RN05 | (0,0) | 16× `N` + `S`        | erro de limite; fica em (0,0)           |
| CA11 | RN06       | (0,0) | `"N"` e depois `"L"` | (1,1)                                   |
| CA12 | RN05, RN06 | (0,1) | 17× `S`              | erro de limite; fica em (0,1)           |
| CA13 | RN07       | (0,0) | `""`                 | (0,0)                                   |
| CA14 | RN07       | (0,0) | `"n"`                | erro de entrada; fica em (0,0)          |
| CA15 | RN07       | (0,0) | `"N L"`              | erro de entrada; fica em (0,0)          |
| CA16 | RN07       | (0,0) | `"1N"`               | erro de entrada; fica em (0,0)          |
| CA17 | RN07       | (0,0) | `"NXN"`              | erro de entrada; fica em (0,0)          |
| CA18 | RN08       | (0,0) | `"D"`                | (0,0), orientação L                     |
| CA19 | RN08       | (0,0) | `"E"`                | (0,0), orientação O                     |
| CA20 | RN08       | (0,0) | `"DDDD"`             | (0,0), orientação N                     |
| CA21 | RN03, RN08 | (0,0) | `"DN"`               | (1,0), orientação L                     |
| CA22 | RN03, RN08 | (0,0) | `"DDN"`              | (0,-1), orientação S                    |
| CA23 | RN03, RN08 | (0,0) | `"DDS"`              | (0,1), orientação S                     |
| CA24 | RN03, RN08 | (0,0) | `"DL"`               | (0,-1), orientação L                    |
| CA25 | RN03, RN08 | (0,0) | `"EN"`               | (-1,0), orientação O                    |
| CA26 | RN05       | (0,0) | `"D"` + 16× `N`      | erro de limite; fica em (0,0) olhando N |
| CA27 | RN06       | (0,0) | `"D"` e depois `"N"` | (1,0), orientação L                     |
| CA28 | RN07       | (0,0) | `"d"`                | erro de entrada; fica em (0,0)          |

## 7. Fora do escopo

- Formato com quantidade de passos (`"1N2L"`).
- Giros diferentes de 90° (ex.: meia-volta como letra própria).
- Múltiplos robôs e obstáculos na malha.
- Persistência do estado entre execuções do programa (fica só em memória).
- Tamanho de malha configurável.

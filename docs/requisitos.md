# Requisitos — Mars Rob

## 1. Visão geral

Sistema de linha de comando que controla um robô numa malha quadrada. O operador
digita comandos de texto (sequências de passos e giros) e o sistema responde com a
nova posição e orientação do robô ou com o motivo da rejeição.

## 2. Glossário

- **Malha (Grid):** área quadrada onde o robô se move, de -limite a limite (inclusive) nos dois eixos, com a origem (0,0) no centro. O limite padrão é 15 (31x31 posições). Substitui os termos "região" e "planeta". O norte da malha é fixo: y+1 é sempre Norte.
- **Obstáculo:** bloco de 1 ou mais posições ligadas pelos lados (reta, L, T, Z, quadrado...), por onde o robô não pode passar. É gerado aleatoriamente ao iniciar o programa.
- **Semente:** número que define o sorteio dos obstáculos. A mesma semente com a mesma configuração gera sempre o mesmo mapa.
- **Posição (Position):** par de coordenadas inteiras (x, y) dentro da malha.
- **Orientação (Orientation):** para onde o robô está virado: `N`, `L`, `S` ou `O`, em relação ao norte da malha.
- **Direção (Direction):** uma das letras `N`, `S`, `L`, `O`. Cada uma é um passo relativo à orientação do robô: frente, trás, direita e esquerda.
- **Giro (Turn):** uma das letras `D` (direita) ou `E` (esquerda). Muda a orientação em 90° sem mudar a posição.
- **Instrução (Instruction):** uma direção ou um giro.
- **Comando (Command):** a string inteira digitada pelo operador, ex.: `"DNLLSESSS"`. As instruções são executadas na ordem em que foram digitadas.

## 3. Regras de negócio

- **RN01** — Estado inicial: o robô começa em (0,0), orientado para o Norte.
- **RN02** — Limites da malha: x e y vão de -limite a limite, inclusive. O limite é um inteiro maior que 0, definido no arquivo de configuração; o padrão é 15.
- **RN03** — Cada direção é um passo relativo à orientação do robô: `N` = frente, `S` = trás, `L` = direita, `O` = esquerda. O deslocamento na malha depende da orientação: olhando para o Norte, `N` = y+1; olhando para o Sul, `N` = y-1.
- **RN04** — A validação de limite é feita a cada passo: o robô não pode atravessar a borda, nem que volte para dentro da malha depois.
- **RN05** — O comando é atômico: se qualquer passo sair da malha, o comando inteiro é rejeitado e o robô mantém a posição e a orientação que tinha antes do comando.
- **RN06** — O estado persiste entre comandos: cada comando parte da posição e da orientação deixadas pelo anterior.
- **RN07** — Comando válido: apenas as letras `N`, `S`, `L`, `O`, `D`, `E`, maiúsculas, sem espaços. A entrada vazia (`""`) é válida e não altera o robô.
- **RN08** — Giro: `D` gira 90° no sentido horário (N→L→S→O→N) e `E` gira 90° no anti-horário. O giro não muda a posição.
- **RN09** — Obstáculos: o robô não pode parar num obstáculo nem atravessá-lo. Assim como o limite (RN04), isso é validado a cada passo, e o comando inteiro é rejeitado (RN05).
- **RN10** — Geração dos obstáculos: ao iniciar, o programa sorteia exatamente `quantidade` obstáculos. O tamanho de cada um é sorteado de 1 a `tamanhoMaximo` posições, e o formato é sorteado também: o obstáculo cresce a partir de uma posição para vizinhos (pelos lados) escolhidos ao acaso, o que gera retas, L, T, Z, quadrados etc. Obstáculos não se sobrepõem nem se encostam (nem na diagonal).
- **RN11** — Acesso garantido: os obstáculos nunca podem impedir o robô de chegar a qualquer posição livre. A origem e os 4 cantos ficam sempre livres, e toda posição livre é alcançável a partir de qualquer outra. Assim o robô sempre consegue chegar aos 4 lados (cima, baixo, esquerda e direita) e aos 4 cantos. Se a configuração não couber na malha sem bloquear o caminho, o programa mostra o erro e encerra com código 1.

## 4. Formato da entrada

- Formato: sequência de letras sem separador. Válidos: `N`, `NLL`, `NLSO`, `DN`, `NE`, `NLSOED`, `""`. Inválidos: `1X`, `L L`, `N1`, `XXX`, `n`, `d`.
- Quantidade de passos: sem limite, desde que o robô não saia da malha (RN04).
- Letras aceitas: `N`, `S`, `L`, `O`, `D`, `E`, somente maiúsculas.
- Espaços: não são aceitos, nem no início/fim.

### Configuração

Arquivo JSON, por padrão `mars-rob.config.json` na pasta do projeto. Outro arquivo: `npm run dev -- --config caminho.json`.
Todas as chaves são opcionais; o que faltar usa o padrão. Sem o arquivo padrão, usa todos os padrões.

```json
{
  "limite": 15,
  "obstaculos": { "quantidade": 4, "tamanhoMaximo": 4 },
  "semente": null
}
```

| Chave                      | Regra | Valores                     | Padrão |
| -------------------------- | ----- | --------------------------- | ------ |
| `limite`                   | RN02  | inteiro > 0                 | 15     |
| `obstaculos.quantidade`    | RN10  | inteiro >= 0                | 4      |
| `obstaculos.tamanhoMaximo` | RN10  | inteiro > 0                 | 4      |
| `semente`                  | RN10  | `null` (sorteia) ou inteiro | `null` |

Configuração inválida (chave com valor errado, JSON inválido, arquivo informado que não existe, obstáculos que não cabem): o programa mostra o erro e encerra com código 1.

## 5. Formato da saída

- Sucesso: `Posição atual (X: 0, Y: -1) para o Sul` (orientação por extenso: Norte, Leste, Sul, Oeste)
- Erro de entrada inválida: `Tipo de entrada inválido, permitido apenas as letras (N,S,L,O,D,E)`
- Erro de limite da malha: `O robô não pode sair do limite da malha`
- Erro de obstáculo: `O robô não pode passar pelo obstáculo em (X: 0, Y: 2)`
- Ao iniciar: resumo (`Malha de -15 a 15 nos dois eixos, 4 obstáculos (semente 123).`), o mapa e a legenda.
- Comando `mapa`: mostra o mapa de novo, com a posição e a orientação atuais do robô.
- Mapa: Norte para cima; `^ > v <` é o robô olhando para N, L, S, O; `#` é obstáculo; `.` é livre. Exemplo de malha com limite 2:

```
. . . . .
. # # # .
. . ^ . .
. . . # .
. . . # .
```

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

Nos CA29–CA33 há um obstáculo fixo de uma posição em (0,2) (nos testes o obstáculo é montado direto, sem sorteio).

| CA   | Regra      | Dado                  | Quando                | Então                                         |
| ---- | ---------- | --------------------- | --------------------- | --------------------------------------------- |
| CA29 | RN09       | (0,0)                 | `"NN"`                | erro de obstáculo; fica em (0,0)              |
| CA30 | RN09       | (0,0)                 | `"NNN"`               | erro de obstáculo (não atravessa); fica (0,0) |
| CA31 | RN05, RN09 | (0,0)                 | `"DDSS"`              | erro de obstáculo; fica em (0,0) olhando N    |
| CA32 | RN09       | (0,0)                 | `"LNNNO"`             | contorna o obstáculo; (0,3)                   |
| CA33 | RN06, RN09 | (0,0)                 | `"N"` e depois `"N"`  | (0,1); depois erro de obstáculo; fica (0,1)   |
| CA34 | RN02       | (0,0), malha limite 5 | 5× `N` e depois `"N"` | (0,5); depois erro de limite; fica (0,5)      |

Geração dos obstáculos (verificada com várias sementes):

| CA   | Regra | Configuração                      | Então                                                                   |
| ---- | ----- | --------------------------------- | ----------------------------------------------------------------------- |
| CA35 | RN10  | quantidade 4, tamanhoMaximo 4     | exatamente 4 obstáculos, cada um com 1 a 4 posições ligadas pelos lados |
| CA36 | RN10  | quantidade 4, tamanhoMaximo 4     | aparecem tanto retas quanto formatos com curva (L, T, Z...)             |
| CA37 | RN10  | quantidade 6                      | nenhum obstáculo encosta em outro                                       |
| CA38 | RN11  | limite 5, quantidade 6, tamanho 5 | origem e cantos livres; toda posição livre é alcançável da origem       |
| CA39 | RN10  | mesma semente duas vezes          | o mesmo mapa                                                            |
| CA40 | RN10  | quantidade 0                      | malha sem obstáculos                                                    |
| CA41 | RN11  | limite 1, quantidade 10           | erro: não há espaço; o programa encerra                                 |

## 7. Fora do escopo

- Formato com quantidade de passos (`"1N2L"`).
- Giros diferentes de 90° (ex.: meia-volta como letra própria).
- Múltiplos robôs.
- Persistência do estado entre execuções do programa (fica só em memória).
- Malha retangular (largura diferente da altura).
- Mudar o limite ou os obstáculos com o programa já rodando.
- Escolher a posição ou o formato de um obstáculo à mão.

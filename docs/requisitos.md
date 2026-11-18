# Requisitos — Mars Rob

## 1. Visão geral

Sistema de linha de comando que controla um ou mais robôs numa malha quadrada. O operador
digita ordens de texto (qual robô executa qual sequência de passos e giros, ou qual robô
envia o mapa para outro) e o sistema responde, para cada ordem, com a nova posição e
orientação do robô, com o resultado do compartilhamento ou com o motivo da rejeição.

## 2. Glossário

- **Malha (Grid):** área quadrada onde o robô se move, de -limite a limite (inclusive) nos dois eixos, com a origem (0,0) no centro. O limite padrão é 15 (31x31 posições). Substitui os termos "região" e "planeta". O norte da malha é fixo: y+1 é sempre Norte.
- **Obstáculo:** bloco de 1 ou mais posições ligadas pelos lados (reta, L, T, Z, quadrado...), por onde o robô não pode passar. É gerado aleatoriamente ao iniciar o programa.
- **Visão / exploração:** o robô enxerga a casa onde está e 1 casa em todas as direções, inclusive diagonais (um quadrado 3x3). Casas que ele já viu ficam exploradas; o resto da malha é desconhecido.
- **Semente:** número que define o sorteio dos obstáculos. A mesma semente com a mesma configuração gera sempre o mesmo mapa.
- **Posição (Position):** par de coordenadas inteiras (x, y) dentro da malha.
- **Orientação (Orientation):** para onde o robô está virado: `N`, `L`, `S` ou `O`, em relação ao norte da malha.
- **Direção (Direction):** uma das letras `N`, `S`, `L`, `O`. Cada uma é um passo relativo à orientação do robô: frente, trás, direita e esquerda.
- **Giro (Turn):** uma das letras `D` (direita) ou `E` (esquerda). Muda a orientação em 90° sem mudar a posição.
- **Instrução (Instruction):** uma direção ou um giro.
- **Robô / ID:** cada robô tem um ID inteiro, de 1 até a quantidade de robôs configurada. Os robôs formam a frota (Fleet).
- **Ordem (Order):** uma instrução para a frota. `ID:COMANDO` move um robô (ex.: `1:NNDE`); `DE>PARA` faz um robô enviar o mapa para outro (ex.: `1>2`). Uma linha pode ter várias ordens separadas por espaço.
- **Lado a lado:** dois robôs em casas vizinhas pelos lados (sem diagonal), ex.: (0,0) e (1,0).
- **Comando (Command):** a parte da ordem depois do `:`, ex.: `"DNLLSESSS"` em `1:DNLLSESSS`. As instruções são executadas na ordem em que foram digitadas.

## 3. Regras de negócio

- **RN01** — Estado inicial: cada robô começa na sua posição inicial (RN13), orientado para o Norte.
- **RN02** — Limites da malha: x e y vão de -limite a limite, inclusive. O limite é um inteiro maior que 0, definido no arquivo de configuração; o padrão é 15.
- **RN03** — Cada direção é um passo relativo à orientação do robô: `N` = frente, `S` = trás, `L` = direita, `O` = esquerda. O deslocamento na malha depende da orientação: olhando para o Norte, `N` = y+1; olhando para o Sul, `N` = y-1.
- **RN04** — A validação de limite é feita a cada passo: o robô não pode atravessar a borda, nem que volte para dentro da malha depois.
- **RN05** — O comando é atômico: se qualquer passo sair da malha, o comando inteiro é rejeitado e o robô mantém a posição e a orientação que tinha antes do comando.
- **RN06** — O estado persiste entre comandos: cada comando de um robô parte da posição e da orientação deixadas pelo comando anterior dele.
- **RN07** — Comando válido: apenas as letras `N`, `S`, `L`, `O`, `D`, `E`, maiúsculas, sem espaços. A entrada vazia (`""`) é válida e não altera o robô.
- **RN08** — Giro: `D` gira 90° no sentido horário (N→L→S→O→N) e `E` gira 90° no anti-horário. O giro não muda a posição.
- **RN09** — Obstáculos: o robô não pode parar num obstáculo nem atravessá-lo. Assim como o limite (RN04), isso é validado a cada passo, e o comando inteiro é rejeitado (RN05).
- **RN10** — Geração dos obstáculos: ao iniciar, o programa sorteia exatamente `quantidade` obstáculos. O tamanho de cada um é sorteado de 1 a `tamanhoMaximo` posições, e o formato é sorteado também: o obstáculo cresce a partir de uma posição para vizinhos (pelos lados) escolhidos ao acaso, o que gera retas, L, T, Z, quadrados etc. Obstáculos não se sobrepõem nem se encostam (nem na diagonal).
- **RN11** — Acesso garantido: os obstáculos nunca podem impedir o robô de chegar a qualquer posição livre. A origem e os 4 cantos ficam sempre livres, e toda posição livre é alcançável a partir de qualquer outra. Assim o robô sempre consegue chegar aos 4 lados (cima, baixo, esquerda e direita) e aos 4 cantos. Se a configuração não couber na malha sem bloquear o caminho, o programa mostra o erro e encerra com código 1.
- **RN12** — Mapa escuro: cada robô tem o próprio mapa, que começa desconhecido e mostra só o que aquele robô já viu (ou recebeu de outro robô, RN16). Ao ser criado, ele vê a vizinhança 3x3 da posição inicial. Em cada passo de um comando aceito, ele vê a vizinhança 3x3 da casa onde está, então todo o caminho é revelado, e não só o destino. Giros não revelam nada. Comando rejeitado não revela nada, porque o robô não saiu do lugar (RN05). Casas fora da malha não contam. Obstáculos dentro da visão aparecem no mapa, mesmo sem o robô bater neles. A exploração se acumula entre comandos. Um robô não sabe onde os outros estão até encontrá-los: no mapa dele, outro robô só aparece enquanto estiver dentro da visão 3x3 atual (se sair da visão, a casa continua conhecida, mas o robô some dela).
- **RN13** — Frota: a quantidade de robôs vem da configuração e vai de 1 até 1 robô a cada 3 de limite, arredondando para baixo (limite 15: até 5; 18: até 6; 21: até 7), e sempre pelo menos 1. Os IDs são 1, 2, 3... O robô 1 nasce na origem; os outros nascem em casas livres sorteadas com a mesma semente dos obstáculos (RN10), sem nascer encostados em outro robô (nem na diagonal). Toda casa livre é alcançável (RN11). A tela inicial informa quantos robôs há, mas não onde estão.
- **RN14** — Ordens: cada linha tem zero ou mais ordens separadas por espaços. `ID:COMANDO` move o robô do ID; o ID é um inteiro sem zero à esquerda e o comando segue a RN07. As ordens rodam em sequência, da esquerda para a direita, e são independentes: uma ordem rejeitada (formato inválido, comando inválido, robô inexistente, limite, obstáculo, colisão) não desfaz as anteriores nem impede as seguintes. O mesmo robô pode receber várias ordens na mesma linha.
- **RN15** — Colisão: um robô não pode parar na casa de outro robô nem atravessá-la. Como o limite e os obstáculos, isso é validado a cada passo, e o comando inteiro é rejeitado (RN05). Vale a posição dos outros robôs no momento da ordem.
- **RN16** — Compartilhar mapa: `DE>PARA` faz o robô DE enviar o mapa dele para o robô PARA, que soma as casas que ainda não conhecia. Só o receptor muda; para trocar nos dois sentidos, use `1>2 2>1`. Os dois robôs precisam estar lado a lado. Um robô não envia o mapa para si mesmo (`1>1` é formato inválido).

## 4. Formato da entrada

- Linha: zero ou mais ordens separadas por um ou mais espaços (espaços nas pontas são ignorados). Ex.: `1:NN 2:DE 1>2`.
- Ordem de movimento: `ID:COMANDO`. Válidas: `1:N`, `2:DNNE`, `1:` (comando vazio: não move e mostra a posição). Formato inválido: `NN`, `0:N`, `01:N`, `a:N`.
- Comando: sequência de letras sem separador. Válidos: `N`, `NLL`, `NLSO`, `DN`, `NE`, `NLSOED`, `""`. Inválidos: `1X`, `N-L`, `N1`, `XXX`, `n`, `d`.
- Quantidade de passos: sem limite, desde que o robô não saia da malha (RN04).
- Letras aceitas: `N`, `S`, `L`, `O`, `D`, `E`, somente maiúsculas.
- Ordem de compartilhamento: `DE>PARA`, ex.: `1>2`. Inválidas: `1>`, `1>1`, `1>2>3`.
- Comandos do sistema (a linha inteira): `mapa ID` (ex.: `mapa 1`) e `sair`.

### Configuração

Arquivo JSON, por padrão `mars-rob.config.json` na pasta do projeto. Outro arquivo: `npm run dev -- --config caminho.json`.
Todas as chaves são opcionais; o que faltar usa o padrão. Sem o arquivo padrão, usa todos os padrões.

```json
{
  "limite": 15,
  "robos": 1,
  "obstaculos": { "quantidade": 4, "tamanhoMaximo": 4 },
  "semente": null
}
```

| Chave                      | Regra | Valores                            | Padrão |
| -------------------------- | ----- | ---------------------------------- | ------ |
| `limite`                   | RN02  | inteiro > 0                        | 15     |
| `robos`                    | RN13  | inteiro de 1 a limite ÷ 3 (mín. 1) | 1      |
| `obstaculos.quantidade`    | RN10  | inteiro >= 0                       | 4      |
| `obstaculos.tamanhoMaximo` | RN10  | inteiro > 0                        | 4      |
| `semente`                  | RN10  | `null` (sorteia) ou inteiro        | `null` |

Configuração inválida (chave com valor errado, JSON inválido, arquivo informado que não existe, obstáculos que não cabem): o programa mostra o erro e encerra com código 1.

## 5. Formato da saída

Uma linha de resposta por ordem, na ordem em que foram digitadas. Linha sem ordens não mostra nada.

- Movimento aceito: `Robô 1: posição atual (X: 0, Y: -1) para o Sul` (orientação por extenso: Norte, Leste, Sul, Oeste)
- Compartilhamento: `Robô 1 enviou o mapa para o robô 2: 12 casas novas` (`1 casa nova`, `nenhuma casa nova`)
- Formato inválido: `Ordem inválida "NN": use ID:COMANDOS (ex.: 1:NNDE) ou DE>PARA (ex.: 1>2)`
- Comando inválido: `Comando inválido em "1:NX", permitido apenas as letras (N,S,L,O,D,E)`
- Robô inexistente: `Não existe robô com ID 9`
- Limite da malha: `Robô 1: não pode sair do limite da malha`
- Obstáculo: `Robô 1: não pode passar pelo obstáculo em (X: 0, Y: 2)`
- Colisão: `Robô 1: não pode passar pelo robô 2 em (X: 0, Y: 2)`
- Robôs longe: `Os robôs 1 e 3 precisam estar lado a lado para compartilhar o mapa`
- Ao iniciar: resumo (`Malha de -15 a 15 nos dois eixos, 4 obstáculos, 3 robôs (semente 123).`) e a ajuda das ordens. Não mostra onde os robôs estão.
- `mapa ID`: título (`Mapa do robô 1`), o mapa daquele robô, quanto ele explorou (`Explorado: 15 de 961 casas`) e a legenda. Sem ID ou com ID mal escrito: `Use "mapa ID" para ver o mapa de um robô, ex.: mapa 1`.
- Mapa: Norte para cima; `^ > v <` é o robô dono do mapa olhando para N, L, S, O; um número é outro robô que ele está vendo agora (o ID dele); `#` é obstáculo; `.` é livre; `?` é desconhecido (RN12). Exemplo de malha com limite 2, logo no início, com um obstáculo visto em (1,1):

```
? ? ? ? ?
? . . # ?
? . ^ . ?
? . . . ?
? ? ? ? ?
```

## 6. Critérios de aceite

Nos CA01–CA48 há um robô só, que parte de (0,0) olhando para o Norte, e cada comando é enviado como a ordem `1:` + comando (ex.: `"N"` é a linha `1:N`). Quando a orientação não é citada, ela continua N.

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
| CA15 | RN07       | (0,0) | `"N-L"`              | erro de entrada; fica em (0,0)          |
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

Mapa escuro (malha com limite 3, sem obstáculos, salvo indicação):

| CA   | Regra      | Dado                    | Quando                     | Então                                                     |
| ---- | ---------- | ----------------------- | -------------------------- | --------------------------------------------------------- |
| CA42 | RN12       | início                  | `"mapa 1"`                 | só o 3x3 em volta da origem aparece; o resto é `?`        |
| CA43 | RN12       | (0,0)                   | `"NNN"`                    | revela o 3x3 de (0,1), (0,2) e (0,3), não só do destino   |
| CA44 | RN12       | (0,0)                   | `"DDDE"`                   | nada novo é revelado                                      |
| CA45 | RN05, RN12 | (0,0)                   | comando que sai da malha   | nada novo é revelado                                      |
| CA46 | RN12       | (15,15) na malha padrão | início                     | só 4 casas exploradas (o resto do 3x3 está fora da malha) |
| CA47 | RN12       | obstáculo em (1,1)      | início                     | o obstáculo aparece como `#` sem o robô bater nele        |
| CA48 | RN12       | (0,0)                   | `"LL"` e depois `"mapa 1"` | `Explorado: 15 de 49 casas`                               |

Vários robôs (malha com limite 3, sem obstáculos, 3 robôs colocados direto nos testes: 1 em (0,0), 2 em (-3,3) e 3 em (3,3), salvo indicação). Aqui as linhas são digitadas como estão:

| CA   | Regra      | Dado                                              | Quando             | Então                                                                         |
| ---- | ---------- | ------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------- |
| CA49 | RN13       | limite 21, 8 obstáculos, 7 robôs, várias sementes | iniciar            | robô 1 em (0,0); os outros em casas livres, sem encostar em nenhum robô       |
| CA50 | RN14       | início                                            | `1:N 2:DN`         | 1 em (0,1) olhando N; 2 em (-2,3) olhando L                                   |
| CA51 | RN14       | início                                            | `2:DN 2:N`         | 2 em (-2,3) e depois em (-1,3)                                                |
| CA52 | RN14       | início                                            | `NN`, `0:N`, `1>1` | erro de formato                                                               |
| CA53 | RN14       | início                                            | `9:N`              | erro: robô 9 não existe                                                       |
| CA54 | RN14       | início                                            | `1:N 2:X 3:EN`     | 1 em (0,1); erro de comando no 2; 3 em (2,3) olhando O                        |
| CA55 | RN15       | 1 em (0,0), 2 em (0,2)                            | `1:NN`             | erro de colisão com o robô 2 em (0,2); 1 fica em (0,0)                        |
| CA56 | RN15       | 1 em (0,0), 2 em (0,2)                            | `1:NNN`            | erro de colisão (não atravessa); 1 fica em (0,0)                              |
| CA57 | RN14, RN15 | 1 em (0,0), 2 em (0,2)                            | `2:L 1:NN`         | 2 em (1,2); depois 1 em (0,2), porque a casa já ficou livre                   |
| CA58 | RN12       | início, 2 robôs                                   | `1:NN` e `mapa 2`  | o mapa do 2 não muda: `Explorado: 4 de 49 casas`                              |
| CA59 | RN12       | 1 em (0,0), 2 em (1,1), 3 em (3,-3)               | `mapa 1`           | o 2 aparece como `2` (está na visão); o 3 não aparece                         |
| CA65 | RN12       | 1 em (0,0), 2 em (1,-1)                           | `1:NN` e `mapa 1`  | (1,-1) continua conhecida, mas o 2 não aparece mais (saiu da visão do 1)      |
| CA60 | RN13       | `"robos": 0`, ou `6` com limite 15/17             | iniciar            | erro de configuração; o programa encerra (com limite 18, 6 robôs são aceitos) |
| CA61 | RN14       | início                                            | linha vazia        | nada é executado nem mostrado                                                 |
| CA62 | RN16       | 1 em (0,0), 2 em (1,0)                            | `1>2 1>2`          | 3 casas novas para o 2; depois nenhuma casa nova                              |
| CA63 | RN16       | início, 2 robôs                                   | `1>2`              | erro: os robôs não estão lado a lado                                          |
| CA64 | RN14, RN16 | 1 em (0,0), 2 em (0,3)                            | `1:NN 1>2`         | 1 vai a (0,2), fica ao lado do 2 e envia o mapa                               |

## 7. Fora do escopo

- Formato com quantidade de passos (`"1N2L"`).
- Giros diferentes de 90° (ex.: meia-volta como letra própria).
- Robôs se movendo ao mesmo tempo (as ordens rodam em sequência, RN14).
- Mapa único compartilhado automaticamente por todos os robôs (cada um tem o seu; a troca é pela RN16).
- Escolher onde cada robô nasce.
- Persistência do estado entre execuções do programa (fica só em memória).
- Malha retangular (largura diferente da altura).
- Mudar o limite ou os obstáculos com o programa já rodando.
- Escolher a posição ou o formato de um obstáculo à mão.

# Linguagem dos robôs

Scripts com sintaxe parecida com JavaScript. Cada **ação** gasta 1 tick: o script pausa nela e
continua no tick seguinte. Sensores e contas não gastam tick.

## Como rodar um script

- Na CLI: `script 1`, as linhas do script e uma linha `fim`. Os ticks rodam até o script terminar
  (no máximo 1000; depois, `ticks N` avança mais e `parar 1` encerra).
- Na interface web: escreva no editor do robô, clique em **Rodar script** e toque o relógio.
  O botão **Referência**, no topo, abre esta referência com busca e exemplos para copiar.
  O editor sugere nomes enquanto você digita (inclusive as variáveis e funções do próprio script
  e, depois de um ponto, os campos): **Ctrl+Espaço** abre a lista, **↑/↓** escolhem, **Enter** ou
  **Tab** aceitam e **Esc** fecha.

Carregar um script troca o programa que o robô estava rodando. Uma ordem direta (`1:NN`) troca o script.

## Exemplo

```js
// anda reto até bater; depois contorna pela direita
while (true) {
  if (type(front()) == 'robot') {
    print('encontrei o robô', front().robot);
    stop();
  } else if (front().isEmpty) {
    forward();
  } else {
    turnRight();
  }
}
```

## Comandos

| Comando                        | Exemplo                                                          |
| ------------------------------ | ---------------------------------------------------------------- |
| variável                       | `let passos = 0`                                                 |
| atribuição                     | `x = 1`, `x += 2`, `x -= 1`, `x *= 2`, `x /= 2`, `x++`, `x--`    |
| se / senão                     | `if (a) { } else if (b) { } else { }`                            |
| enquanto                       | `while (cond) { }`                                               |
| para                           | `for (let i = 0; i < 4; i++) { }`                                |
| para cada                      | `for (let cell of see()) { }`                                    |
| sair do loop / pular uma volta | `break`, `continue`                                              |
| função                         | `function andar(n) { ... return n }`                             |
| classe e objeto                | `class Contador { ... }`, `let c = new Contador(1)` (ver abaixo) |
| comentário                     | `// linha` ou `/* bloco */`                                      |

O ponto e vírgula é opcional. As chaves são opcionais quando o corpo é um único comando.
Funções podem ser chamadas antes da linha em que foram declaradas e enxergam as variáveis
de onde foram criadas (closures).

## Valores e operadores

- Números (`1`, `2.5`), textos (`"a"` ou `'a'`), `true`, `false`, `null` e listas (`[1, 2]`).
- Aritmética: `+ - * / %`. O `+` com um texto junta os dois (`"x = " + 1`).
- Comparação: `== != < <= > >=`. `<` e `>` só comparam número com número ou texto com texto.
  Posições, casas e `self` são comparados pelo valor: `self.position == cellAt(2, 3).position` é
  `true` quando x e y são iguais. Listas e objetos criados com `new` são comparados pela
  identidade (só são iguais a eles mesmos).
- Lógica: `&& || !`. `false`, `null`, `0` e `""` contam como falso.
- Listas: `lista[0]`, `lista.length`, `lista.push(x)`, `lista.pop()`, `lista.shift()`, `lista.includes(x)`.

## Classes

Uma classe junta dados e funções. O `constructor` roda no `new`; dentro dos métodos, `this` é o
objeto. Os campos são criados ao atribuir (`this.passos = 0`) e podem ser alterados de fora
(`a.passos = 5`). Os métodos escrevem só o nome, sem `function`.

```js
class Andarilho {
  constructor(limite) {
    this.limite = limite;
    this.passos = 0;
  }
  andar() {
    if (this.passos < this.limite && forward()) {
      this.passos++;
      return true;
    }
    return false;
  }
}

let a = new Andarilho(10);
while (a.andar()) {}
print(a); // Andarilho { limite: 10, passos: 10 }
```

- Classes, como funções, podem ser usadas antes da linha em que foram declaradas.
- Métodos podem fazer ações (gastam tick) e usar `self`, o robô. `this` é o objeto, não o robô.
- `type(objeto)` devolve o nome da classe.
- Herança (`extends`) ainda não existe.

## Ações (gastam 1 tick)

Cada ação devolve `true` se deu certo e `false` se não deu (ex.: andar contra um obstáculo).

| Ação             | Efeito                                                |
| ---------------- | ----------------------------------------------------- |
| `forward()`      | um passo para a frente                                |
| `backward()`     | um passo para trás                                    |
| `stepRight()`    | um passo para a direita (sem girar)                   |
| `stepLeft()`     | um passo para a esquerda (sem girar)                  |
| `turnRight()`    | gira 90° para a direita                               |
| `turnLeft()`     | gira 90° para a esquerda                              |
| `wait()`         | fica parado um tick                                   |
| `shareMap(id)`   | envia o mapa para o robô `id` (precisa estar ao lado) |
| `forgetMap()`    | apaga o mapa do robô (ver abaixo)                     |
| `goTo(x, y)`     | vai até (x, y), 1 passo por tick (ver abaixo)         |
| `goNextTo(x, y)` | vai até uma casa ao lado de (x, y)                    |
| `face(x, y)`     | gira para olhar para a casa adjacente (x, y)          |
| `recharge()`     | recarrega na base                                     |
| `collect()`      | pega o item da casa onde o robô está                  |
| `discard(tipo, quantidade?)` | coloca no mapa os itens escolhidos da mochila; quantidade padrão: 1 |
| `discardAll()`   | coloca todos os itens da mochila em casas livres no mapa |
| `withdraw(tipo, quantidade?)` | na base, transfere itens do armazem para a mochila |
| `discardWarehouse(tipo, quantidade?)` | na base, coloca itens do armazem em casas livres no mapa |
| `unload()`       | descarrega no armazém da base todos os itens que couberem; pode ser repetido se ainda sobrar carga |
| `mine()`         | quebra rochas ou minera cobre, ferro, ouro e diamante (exige picareta de nível adequado) |
| `chop()`         | corta a árvore à frente (exige machado de nível adequado); deixa madeira no chão |
| `upgrade(tipo)`  | compra uma melhoria na base                           |
| `stop()`         | encerra o programa (não gasta tick)                   |

`goTo(x, y)` leva o robô até a casa (x, y) pelo menor caminho no mapa dele, um passo por tick e
sem girar (anda de frente, de costas ou de lado). Ele só anda por casas que já conhece: contorna os
obstáculos e os robôs que está vendo, e nunca entra em casa desconhecida. O caminho é calculado uma
vez, no começo: se um passo for bloqueado (outro robô entrou no caminho), ele para ali e `goTo`
devolve `false`. Ao chegar, devolve `true`. Se o destino está fora da malha, é desconhecido, é um
obstáculo ou não há caminho conhecido, devolve `false` sem gastar tick.

```js
if (!goTo(5, 5)) {
  print('parei em', self.position);
}
```

`forgetMap()` faz o robô esquecer o mapa e as casas visitadas. Como ele continua no mesmo
lugar, volta a conhecer a própria casa (como visitada) e o 3x3 em volta, igual a quando nasceu.

## Sensores (não gastam tick)

| Sensor                                   | Devolve                                                                                                    |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `front()`, `back()`, `left()`, `right()` | a casa vizinha, relativa a para onde o robô olha                                                           |
| `see()`                                  | lista das casas da visão (3x3 em volta, sem a do próprio robô)                                             |
| `cellAt(x, y)`                           | a casa no mapa do robô (`"unknown"` se ele ainda não viu)                                                  |
| `explored()`                             | quantas casas o robô já conhece                                                                            |
| `nearestUnknown()`                       | a casa conhecida e livre mais próxima (em passos) de onde ele vê algo desconhecido, ou `null` (ver abaixo) |
| `nearestItem(tipo?)`                     | item conhecido e alcançável mais próximo; tipo é opcional (galhos, pedras, madeiras e minerais)             |
| `nearestOre()`                           | jazida conhecida e alcançável mais próxima                                                                 |
| `battery()`, `maxBattery()`              | carga atual e capacidade da bateria                                                                        |
| `cargo()`, `maxCargo()`                  | espaço ocupado e capacidade do compartimento do robô                                                       |
| `inventory()`                            | lista os itens da mochila na Saidas e devolve a lista                                                   |
| `base()`                                 | posição da base (`.x`, `.y`)                                                                               |
| `warehouse()`                            | lista os itens do armazem na Saidas e devolve os campos `used` e `capacity`                             |
| `canUpgrade(tipo)`, `level(tipo)`        | se uma melhoria pode ser comprada e o nível atual                                                          |
| `self`                                   | o próprio robô: `self.id`, `self.position`, `self.orientation` (`"north"`, `"east"`, `"south"`, `"west"`)  |

Uma **casa** tem:

| Campo           | O que é                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------- |
| `type`          | `"empty"`, `"obstacle"`, `"robot"`, `"edge"` (fora da malha) ou `"unknown"`              |
| `isEmpty`       | `true` se a casa está livre                                                              |
| `isUnknown`     | `true` se o robô ainda não viu a casa                                                    |
| `visited`       | `true` se o robô já esteve nela (ver de longe ou receber o mapa não conta)               |
| `unknownAround` | quantas casas desconhecidas há no 3x3 dela (0 a 9): o que o robô descobriria parando ali |
| `position`      | a posição (`.x`, `.y`)                                                                   |
| `robot`         | o ID do robô que está nela, ou `null`                                                    |
| `item`          | item no chão: galho, pedra, tipo de madeira ou mineral; `null` se não há                 |
| `obstacle`      | obstáculo: `rock`, `tree` ou `ore`; `null` se não há                                     |
| `isBase`        | `true` se a casa contém a base                                                           |

As casas vizinhas (`front()` etc.) estão sempre na visão, então nunca são `"unknown"`. Para
explorar, olhe o `unknownAround` delas, ou use `cellAt(x, y)` para casas mais longe:

```js
// vai para o lado que revela mais casas novas
if (left().isEmpty && left().unknownAround > front().unknownAround) {
  turnLeft();
}
if (front().isEmpty) forward();
else turnRight();
```

`nearestUnknown()` procura, pelo caminho que `goTo` faria, a casa mais perto de onde o robô
descobriria algo novo (`unknownAround` maior que 0). Ela é conhecida, então `goTo` chega nela.
Devolve `null` quando não sobrou nada desconhecido que ele consiga alcançar. Para explorar tudo:

```js
let c = nearestUnknown();
while (c != null) {
  goTo(c.position.x, c.position.y);
  c = nearestUnknown();
}
```

## Funções

| Função                 | Devolve                                                                                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type(x)`              | para uma casa, o que há nela; para outros valores, `"number"`, `"string"`, `"boolean"`, `"null"`, `"list"`, `"function"`, `"position"`, `"robot"`, `"class"` ou o nome da classe de um objeto |
| `print(a, b, ...)`     | escreve os valores separados por espaço                                                                                                                                                       |
| `abs(n)`, `floor(n)`   | valor absoluto, arredondado para baixo                                                                                                                                                        |
| `min(...)`, `max(...)` | menor e maior número                                                                                                                                                                          |

## Limites e erros

- Entre duas ações, o script pode fazer no máximo 10.000 operações. Um `while (true) {}` sem ação
  vira erro em vez de travar a simulação.
- Recursão: no máximo 200 chamadas aninhadas.
- Erros de sintaxe aparecem ao carregar o script; erros de execução encerram o programa.
  Os dois informam linha e coluna, ex.: `Erro na linha 3, coluna 9: "y" não foi declarado`.
- `self` e os nomes da linguagem não podem ser alterados. Dá para declarar uma variável com o
  mesmo nome de uma função da linguagem (`let forward = 3`), o que esconde a função naquele escopo.
- Quando um nome não existe, o erro sugere um parecido: `"fordward" não foi declarado. Você quis
dizer "forward"?`. O mesmo vale para campos (`front().isEmty`).
- Chamar um campo como função explica o que fazer: `front().isEmpty()` dá `"isEmpty" é um campo,
não uma função: use front().isEmpty, sem os parênteses`.
- Quem vem de outras linguagens recebe uma dica ao escrever `not`, `and`, `or`, `===`, `!==`,
  `var` ou `const` (use `!`, `&&`, `||`, `==`, `!=` e `let`).





No painel **Saidas**, abaixo do editor de scripts, aparecem os retornos das acoes e os valores das funcoes `inventory()` e `warehouse()`.

Capacidade inicial: mochila com 5 espacos e armazem com 10. Cada melhoria acrescenta 5 espacos a mochila ou 10 ao armazem.

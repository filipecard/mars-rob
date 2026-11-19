# Linguagem dos robôs

Scripts com sintaxe parecida com JavaScript. Cada **ação** gasta 1 tick: o script pausa nela e
continua no tick seguinte. Sensores e contas não gastam tick.

## Como rodar um script

- Na CLI: `script 1`, as linhas do script e uma linha `fim`. Os ticks rodam até o script terminar
  (no máximo 1000; depois, `ticks N` avança mais e `parar 1` encerra).
- Na interface web: escreva no editor do robô, clique em **Rodar script** e toque o relógio.

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

| Comando                        | Exemplo                                                       |
| ------------------------------ | ------------------------------------------------------------- |
| variável                       | `let passos = 0`                                              |
| atribuição                     | `x = 1`, `x += 2`, `x -= 1`, `x *= 2`, `x /= 2`, `x++`, `x--` |
| se / senão                     | `if (a) { } else if (b) { } else { }`                         |
| enquanto                       | `while (cond) { }`                                            |
| para                           | `for (let i = 0; i < 4; i++) { }`                             |
| para cada                      | `for (let cell of see()) { }`                                 |
| sair do loop / pular uma volta | `break`, `continue`                                           |
| função                         | `function andar(n) { ... return n }`                          |
| comentário                     | `// linha` ou `/* bloco */`                                   |

O ponto e vírgula é opcional. As chaves são opcionais quando o corpo é um único comando.
Funções podem ser chamadas antes da linha em que foram declaradas e enxergam as variáveis
de onde foram criadas (closures).

## Valores e operadores

- Números (`1`, `2.5`), textos (`"a"` ou `'a'`), `true`, `false`, `null` e listas (`[1, 2]`).
- Aritmética: `+ - * / %`. O `+` com um texto junta os dois (`"x = " + 1`).
- Comparação: `== != < <= > >=`. `<` e `>` só comparam número com número ou texto com texto.
- Lógica: `&& || !`. `false`, `null`, `0` e `""` contam como falso.
- Listas: `lista[0]`, `lista.length`, `lista.push(x)`, `lista.pop()`, `lista.shift()`, `lista.includes(x)`.

## Ações (gastam 1 tick)

Cada ação devolve `true` se deu certo e `false` se não deu (ex.: andar contra um obstáculo).

| Ação           | Efeito                                                |
| -------------- | ----------------------------------------------------- |
| `forward()`    | um passo para a frente                                |
| `backward()`   | um passo para trás                                    |
| `stepRight()`  | um passo para a direita (sem girar)                   |
| `stepLeft()`   | um passo para a esquerda (sem girar)                  |
| `turnRight()`  | gira 90° para a direita                               |
| `turnLeft()`   | gira 90° para a esquerda                              |
| `wait()`       | fica parado um tick                                   |
| `shareMap(id)` | envia o mapa para o robô `id` (precisa estar ao lado) |
| `stop()`       | encerra o programa (não gasta tick)                   |

## Sensores (não gastam tick)

| Sensor                                   | Devolve                                                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `front()`, `back()`, `left()`, `right()` | a casa vizinha, relativa a para onde o robô olha                                                          |
| `see()`                                  | lista das casas da visão (3x3 em volta, sem a do próprio robô)                                            |
| `cellAt(x, y)`                           | a casa no mapa do robô (`"unknown"` se ele ainda não viu)                                                 |
| `explored()`                             | quantas casas o robô já conhece                                                                           |
| `self`                                   | o próprio robô: `self.id`, `self.position`, `self.orientation` (`"north"`, `"east"`, `"south"`, `"west"`) |

Uma **casa** tem: `type` (`"empty"`, `"obstacle"`, `"robot"`, `"edge"` fora da malha, `"unknown"`),
`isEmpty`, `position` (`.x`, `.y`) e `robot` (o ID do robô que está nela, ou `null`).

## Funções

| Função                 | Devolve                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type(x)`              | para uma casa, o que há nela; para outros valores, `"number"`, `"string"`, `"boolean"`, `"null"`, `"list"`, `"function"`, `"position"` ou `"robot"` |
| `print(a, b, ...)`     | escreve os valores separados por espaço                                                                                                             |
| `abs(n)`, `floor(n)`   | valor absoluto, arredondado para baixo                                                                                                              |
| `min(...)`, `max(...)` | menor e maior número                                                                                                                                |

## Limites e erros

- Entre duas ações, o script pode fazer no máximo 10.000 operações. Um `while (true) {}` sem ação
  vira erro em vez de travar a simulação.
- Recursão: no máximo 200 chamadas aninhadas.
- Erros de sintaxe aparecem ao carregar o script; erros de execução encerram o programa.
  Os dois informam linha e coluna, ex.: `Erro na linha 3, coluna 9: "y" não foi declarado`.
- `self` e os nomes da linguagem não podem ser alterados. Dá para declarar uma variável com o
  mesmo nome de uma função da linguagem (`let forward = 3`), o que esconde a função naquele escopo.

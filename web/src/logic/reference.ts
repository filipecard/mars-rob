// Referência da linguagem dos robôs: alimenta o painel de ajuda e o autocomplete.
// Mesmo conteúdo de docs/linguagem.md (um teste na raiz confere se nada ficou de fora).

export type EntryKind =
  | 'action'
  | 'sensor'
  | 'function'
  | 'keyword'
  | 'cellField'
  | 'selfField'
  | 'positionField'
  | 'listMember';

export interface Entry {
  name: string;
  kind: EntryKind;
  // Como aparece na ajuda, ex.: "shareMap(id)"
  signature: string;
  description: string;
  // Funções: quantos argumentos recebe (o autocomplete põe o cursor dentro dos parênteses)
  params?: number;
}

export const ENTRIES: readonly Entry[] = [
  // Ações: gastam 1 tick e devolvem true/false
  {
    name: 'forward',
    kind: 'action',
    signature: 'forward()',
    description: 'Um passo para a frente.',
    params: 0,
  },
  {
    name: 'backward',
    kind: 'action',
    signature: 'backward()',
    description: 'Um passo para trás.',
    params: 0,
  },
  {
    name: 'stepRight',
    kind: 'action',
    signature: 'stepRight()',
    description: 'Um passo para a direita, sem girar.',
    params: 0,
  },
  {
    name: 'stepLeft',
    kind: 'action',
    signature: 'stepLeft()',
    description: 'Um passo para a esquerda, sem girar.',
    params: 0,
  },
  {
    name: 'turnRight',
    kind: 'action',
    signature: 'turnRight()',
    description: 'Gira 90° para a direita.',
    params: 0,
  },
  {
    name: 'turnLeft',
    kind: 'action',
    signature: 'turnLeft()',
    description: 'Gira 90° para a esquerda.',
    params: 0,
  },
  {
    name: 'wait',
    kind: 'action',
    signature: 'wait()',
    description: 'Fica parado um tick.',
    params: 0,
  },
  {
    name: 'shareMap',
    kind: 'action',
    signature: 'shareMap(id)',
    description:
      'Envia o mapa para o robô id. Ele precisa estar ao lado (sem diagonal).',
    params: 1,
  },
  {
    name: 'goTo',
    kind: 'action',
    signature: 'goTo(x, y)',
    description:
      'Vai até (x, y) pelo menor caminho, só por casas que já conhece, um passo por tick e sem girar. Contorna obstáculos e robôs que está vendo. Se algo bloquear um passo, para ali e devolve false; ao chegar, true. Destino desconhecido ou sem caminho conhecido: devolve false na hora.',
    params: 2,
  },
  {
    name: 'forgetMap',
    kind: 'action',
    signature: 'forgetMap()',
    description:
      'Apaga o mapa do robô: ele esquece tudo e as casas visitadas, e volta a conhecer só o 3x3 em volta. Devolve true.',
    params: 0,
  },
  {
    name: 'stop',
    kind: 'action',
    signature: 'stop()',
    description: 'Encerra o programa. Não gasta tick.',
    params: 0,
  },

  // Sensores: não gastam tick
  {
    name: 'front',
    kind: 'sensor',
    signature: 'front()',
    description: 'A casa da frente (relativa a para onde o robô olha).',
    params: 0,
  },
  {
    name: 'back',
    kind: 'sensor',
    signature: 'back()',
    description: 'A casa de trás.',
    params: 0,
  },
  {
    name: 'left',
    kind: 'sensor',
    signature: 'left()',
    description: 'A casa da esquerda.',
    params: 0,
  },
  {
    name: 'right',
    kind: 'sensor',
    signature: 'right()',
    description: 'A casa da direita.',
    params: 0,
  },
  {
    name: 'see',
    kind: 'sensor',
    signature: 'see()',
    description: 'Lista das 8 casas em volta (visão 3x3), de cima para baixo.',
    params: 0,
  },
  {
    name: 'cellAt',
    kind: 'sensor',
    signature: 'cellAt(x, y)',
    description:
      'A casa (x, y) no mapa do robô. Tipo "unknown" se ele ainda não a viu.',
    params: 2,
  },
  {
    name: 'explored',
    kind: 'sensor',
    signature: 'explored()',
    description: 'Quantas casas o robô já conhece.',
    params: 0,
  },
  {
    name: 'nearestUnknown',
    kind: 'sensor',
    signature: 'nearestUnknown()',
    description:
      'A casa conhecida e livre mais próxima (em passos) de onde o robô vê alguma casa desconhecida, ou null se não há mais nada a descobrir ao alcance. Use com goTo para explorar.',
    params: 0,
  },
  {
    name: 'self',
    kind: 'sensor',
    signature: 'self',
    description: 'O próprio robô: self.id, self.position, self.orientation.',
  },

  // Funções
  {
    name: 'type',
    kind: 'function',
    signature: 'type(x)',
    description:
      'Para uma casa, o que há nela ("empty", "obstacle", "robot", "edge", "unknown"). Para outros valores, o nome do tipo.',
    params: 1,
  },
  {
    name: 'print',
    kind: 'function',
    signature: 'print(a, b, ...)',
    description: 'Escreve os valores no diário, separados por espaço.',
    params: 1,
  },
  {
    name: 'abs',
    kind: 'function',
    signature: 'abs(n)',
    description: 'Valor absoluto.',
    params: 1,
  },
  {
    name: 'floor',
    kind: 'function',
    signature: 'floor(n)',
    description: 'Arredonda para baixo.',
    params: 1,
  },
  {
    name: 'min',
    kind: 'function',
    signature: 'min(a, b, ...)',
    description: 'O menor número.',
    params: 1,
  },
  {
    name: 'max',
    kind: 'function',
    signature: 'max(a, b, ...)',
    description: 'O maior número.',
    params: 1,
  },

  // Palavras da linguagem
  {
    name: 'let',
    kind: 'keyword',
    signature: 'let nome = valor',
    description: 'Declara uma variável.',
  },
  {
    name: 'if',
    kind: 'keyword',
    signature: 'if (cond) { } else if (cond) { } else { }',
    description: 'Condição.',
  },
  {
    name: 'else',
    kind: 'keyword',
    signature: 'else { }',
    description: 'O caminho quando a condição do if é falsa.',
  },
  {
    name: 'while',
    kind: 'keyword',
    signature: 'while (cond) { }',
    description: 'Repete enquanto a condição for verdadeira.',
  },
  {
    name: 'for',
    kind: 'keyword',
    signature: 'for (let i = 0; i < 4; i++) { }  ·  for (let c of see()) { }',
    description: 'Laço com contador, ou para cada item de uma lista.',
  },
  {
    name: 'of',
    kind: 'keyword',
    signature: 'for (let item of lista) { }',
    description: 'Percorre os itens de uma lista.',
  },
  {
    name: 'function',
    kind: 'keyword',
    signature: 'function nome(a, b) { return a + b }',
    description:
      'Declara uma função. Pode ser chamada antes da linha em que foi declarada.',
  },
  {
    name: 'return',
    kind: 'keyword',
    signature: 'return valor',
    description: 'Sai da função devolvendo o valor.',
  },
  {
    name: 'break',
    kind: 'keyword',
    signature: 'break',
    description: 'Sai do laço.',
  },
  {
    name: 'continue',
    kind: 'keyword',
    signature: 'continue',
    description: 'Pula para a próxima volta do laço.',
  },
  {
    name: 'true',
    kind: 'keyword',
    signature: 'true',
    description: 'Verdadeiro.',
  },
  { name: 'false', kind: 'keyword', signature: 'false', description: 'Falso.' },
  {
    name: 'null',
    kind: 'keyword',
    signature: 'null',
    description: 'Nenhum valor.',
  },

  // Campos de uma casa
  {
    name: 'type',
    kind: 'cellField',
    signature: 'casa.type',
    description:
      '"empty", "obstacle", "robot", "edge" (fora da malha) ou "unknown".',
  },
  {
    name: 'isEmpty',
    kind: 'cellField',
    signature: 'casa.isEmpty',
    description: 'true se a casa está livre (dá para andar nela).',
  },
  {
    name: 'isUnknown',
    kind: 'cellField',
    signature: 'casa.isUnknown',
    description: 'true se o robô ainda não viu a casa.',
  },
  {
    name: 'visited',
    kind: 'cellField',
    signature: 'casa.visited',
    description:
      'true se o robô já esteve nela (ver de longe não conta; mapa recebido também não).',
  },
  {
    name: 'unknownAround',
    kind: 'cellField',
    signature: 'casa.unknownAround',
    description:
      'Quantas casas desconhecidas há no 3x3 dela: o que o robô descobriria parando ali (0 a 9).',
  },
  {
    name: 'position',
    kind: 'cellField',
    signature: 'casa.position',
    description: 'A posição da casa (.x, .y).',
  },
  {
    name: 'robot',
    kind: 'cellField',
    signature: 'casa.robot',
    description: 'O ID do robô que está nela, ou null.',
  },

  // Campos de self
  {
    name: 'id',
    kind: 'selfField',
    signature: 'self.id',
    description: 'O ID do robô.',
  },
  {
    name: 'position',
    kind: 'selfField',
    signature: 'self.position',
    description: 'Onde o robô está (.x, .y).',
  },
  {
    name: 'orientation',
    kind: 'selfField',
    signature: 'self.orientation',
    description: 'Para onde olha: "north", "east", "south" ou "west".',
  },

  // Campos de uma posição
  {
    name: 'x',
    kind: 'positionField',
    signature: 'posição.x',
    description: 'Coluna.',
  },
  {
    name: 'y',
    kind: 'positionField',
    signature: 'posição.y',
    description: 'Linha.',
  },

  // Listas
  {
    name: 'length',
    kind: 'listMember',
    signature: 'lista.length',
    description: 'Quantos itens a lista tem.',
  },
  {
    name: 'push',
    kind: 'listMember',
    signature: 'lista.push(x)',
    description: 'Põe x no fim.',
    params: 1,
  },
  {
    name: 'pop',
    kind: 'listMember',
    signature: 'lista.pop()',
    description: 'Tira e devolve o último item.',
    params: 0,
  },
  {
    name: 'shift',
    kind: 'listMember',
    signature: 'lista.shift()',
    description: 'Tira e devolve o primeiro item.',
    params: 0,
  },
  {
    name: 'includes',
    kind: 'listMember',
    signature: 'lista.includes(x)',
    description: 'true se x está na lista.',
    params: 1,
  },
];

export const KIND_LABELS: Record<EntryKind, string> = {
  action: 'ação',
  sensor: 'sensor',
  function: 'função',
  keyword: 'palavra',
  cellField: 'casa',
  selfField: 'self',
  positionField: 'posição',
  listMember: 'lista',
};

export interface Section {
  title: string;
  intro: string;
  kinds: readonly EntryKind[];
}

export const SECTIONS: readonly Section[] = [
  {
    title: 'Ações',
    intro:
      'Cada ação gasta 1 tick: o script pausa nela e continua no tick seguinte. Devolve true se deu certo e false se não (ex.: andar contra um obstáculo).',
    kinds: ['action'],
  },
  {
    title: 'Sensores',
    intro:
      'Não gastam tick. Mostram só o que o robô vê agora (3x3 em volta) ou o que está no mapa dele.',
    kinds: ['sensor'],
  },
  {
    title: 'Casa',
    intro: 'O que front(), see(), cellAt(x, y) e os outros sensores devolvem.',
    kinds: ['cellField'],
  },
  {
    title: 'self e posição',
    intro: 'O próprio robô e as posições (de self ou de uma casa).',
    kinds: ['selfField', 'positionField'],
  },
  {
    title: 'Funções',
    intro: 'Não gastam tick.',
    kinds: ['function'],
  },
  {
    title: 'Listas',
    intro: 'Listas com [1, 2, 3]; o primeiro item é lista[0].',
    kinds: ['listMember'],
  },
  {
    title: 'Comandos',
    intro:
      'Sintaxe parecida com JavaScript. Ponto e vírgula opcional. Operadores: + - * / %, == != < <= > >=, && || !, e x += 1, x++.',
    kinds: ['keyword'],
  },
];

export interface Example {
  title: string;
  source: string;
}

export const EXAMPLES: readonly Example[] = [
  {
    title: 'Andar reto e contornar',
    source: `while (true) {
  if (front().isEmpty) {
    forward()
  } else {
    turnRight()
  }
}
`,
  },
  {
    title: 'Parar ao encontrar outro robô',
    source: `while (true) {
  for (let cell of see()) {
    if (type(cell) == "robot") {
      print("achei o robô", cell.robot, "em", cell.position)
      stop()
    }
  }
  if (front().isEmpty) forward()
  else turnLeft()
}
`,
  },
  {
    title: 'Explorar: ir para onde há mais desconhecido',
    source: `// Vale mais a casa que revela mais desconhecido;
// casas já visitadas valem um pouco menos, para não andar em círculo
function score(cell) {
  if (!cell.isEmpty) return -100
  let s = cell.unknownAround * 10
  if (cell.visited) s -= 5
  return s
}

while (true) {
  let f = score(front())
  let r = score(right())
  let l = score(left())
  if (f >= r && f >= l && f > -100) {
    forward()
  } else if (r >= l && r > -100) {
    turnRight()
  } else if (l > -100) {
    turnLeft()
  } else {
    turnRight()
    turnRight()
  }
}
`,
  },
];

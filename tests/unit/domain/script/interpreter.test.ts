import { describe, expect, it } from 'vitest';
import {
  MAX_OPERATIONS,
  ScriptProcess,
} from '../../../../src/domain/script/interpreter.js';
import {
  ScriptRuntimeError,
  ScriptSyntaxError,
} from '../../../../src/domain/script/ScriptError.js';
import { FakeHost, kinds, runScript } from './fakeHost.js';

// Roda e devolve o que o script imprimiu
function printed(source: string): string[] {
  const { host, last } = runScript(source);
  if (last.kind === 'error') {
    throw last.error;
  }
  return host.printed;
}

// Roda e devolve o erro de execução
function runtimeError(source: string): ScriptRuntimeError {
  const { last } = runScript(source);
  if (last.kind !== 'error') {
    throw new Error(`esperava erro, terminou com ${last.kind}`);
  }
  return last.error;
}

describe('ScriptProcess — ações e ticks', () => {
  it('pausa a cada ação: uma ação por chamada de next()', () => {
    const process = ScriptProcess.compile(
      'forward()\nturnRight()\nforward()',
      new FakeHost(),
    );

    expect(process.next()).toEqual({
      kind: 'action',
      action: { kind: 'forward' },
    });
    expect(process.next(true)).toEqual({
      kind: 'action',
      action: { kind: 'turnRight' },
    });
    expect(process.next(true)).toEqual({
      kind: 'action',
      action: { kind: 'forward' },
    });
    expect(process.next(true)).toEqual({ kind: 'finished' });
    expect(process.finished).toBe(true);
    expect(process.next()).toEqual({ kind: 'finished' });
  });

  it('todas as ações da linguagem', () => {
    const { actions } = runScript(
      'forward(); backward(); stepRight(); stepLeft(); turnRight(); turnLeft(); wait(); shareMap(2)',
    );

    expect(actions).toEqual([
      { kind: 'forward' },
      { kind: 'backward' },
      { kind: 'stepRight' },
      { kind: 'stepLeft' },
      { kind: 'turnRight' },
      { kind: 'turnLeft' },
      { kind: 'wait' },
      { kind: 'shareMap', to: 2 },
    ]);
  });

  it('a ação devolve se deu certo', () => {
    const { actions } = runScript('if (!forward()) { turnRight() }', {
      answer: () => false,
    });

    expect(kinds(actions)).toEqual(['forward', 'turnRight']);
  });

  it('anda reto enquanto a frente está vazia', () => {
    const host = new FakeHost();
    const { actions } = runScript(
      'while (type(front()) == "empty") { forward() }',
      {
        host,
        // depois do 3º passo aparece um obstáculo na frente
        answer: (_action, index) => {
          if (index === 2) {
            host.cells.front = { type: 'obstacle', x: 0, y: 4, robot: null };
          }
          return true;
        },
      },
    );

    expect(kinds(actions)).toEqual(['forward', 'forward', 'forward']);
  });

  it('loop infinito com ações roda para sempre, um passo por tick', () => {
    const { actions, last } = runScript('while (true) { forward() }', {
      maxSteps: 50,
    });

    expect(actions).toHaveLength(50);
    expect(last.kind).toBe('action');
  });

  it('o limite de operações vale entre duas ações, não no total', () => {
    const { actions, last } = runScript(
      `for (let t = 0; t < 3; t++) {
        let i = 0
        while (i < ${String(MAX_OPERATIONS / 4)}) { i++ }
        wait()
      }`,
    );

    expect(kinds(actions)).toEqual(['wait', 'wait', 'wait']);
    expect(last.kind).toBe('finished');
  });

  it('loop sem ação vira erro em vez de travar o tick', () => {
    expect(runtimeError('while (true) {}').reason).toMatch(
      /operações sem nenhuma ação/,
    );
  });

  it('stop() encerra o programa sem erro', () => {
    const { actions, last } = runScript('forward()\nstop()\nforward()');

    expect(kinds(actions)).toEqual(['forward']);
    expect(last).toEqual({ kind: 'finished' });
  });

  it('erro de sintaxe aparece ao compilar, antes de rodar', () => {
    expect(() => ScriptProcess.compile('while (', new FakeHost())).toThrow(
      ScriptSyntaxError,
    );
  });
});

describe('ScriptProcess — linguagem', () => {
  it('variáveis, aritmética e textos', () => {
    expect(
      printed(`
        let a = 7
        let b = 2
        print(a + b, a - b, a * b, a / b, a % b, -a)
        print("x = " + a, "ok" + true, 1 + 2 + "3")
        a += 1; a -= 2; a *= 3; a /= 2; a++; a--
        print(a)
      `),
    ).toEqual(['9 5 14 3.5 1 -7', 'x = 7 oktrue 33', '9']);
  });

  it('comparações e lógica com curto-circuito', () => {
    expect(
      printed(`
        print(1 < 2, 2 <= 2, 3 > 4, 4 >= 5, "a" < "b", 1 == 1, 1 != "1")
        print(true && "sim", 0 || "padrão", null && forward(), !0, !"x")
      `),
    ).toEqual([
      'true true false false true true true',
      'sim padrão null true false',
    ]);
  });

  it('if / else if / else', () => {
    const source = (n: number): string => `
      let n = ${String(n)}
      if (n < 0) { print("negativo") }
      else if (n == 0) { print("zero") }
      else { print("positivo") }
    `;

    expect([source(-1), source(0), source(5)].map(printed)).toEqual([
      ['negativo'],
      ['zero'],
      ['positivo'],
    ]);
  });

  it('for, while, break e continue', () => {
    expect(
      printed(`
        let out = []
        for (let i = 0; i < 10; i++) {
          if (i % 2 == 0) { continue }
          if (i > 7) { break }
          out.push(i)
        }
        let j = 0
        while (true) { j++; if (j == 3) break }
        print(out, j)
      `),
    ).toEqual(['[1, 3, 5, 7] 3']);
  });

  it('for of em listas e textos', () => {
    expect(
      printed(`
        let total = 0
        for (let n of [1, 2, 3]) { total += n }
        let letters = []
        for (let c of "abc") { letters.push(c) }
        print(total, letters)
      `),
    ).toEqual(['6 [a, b, c]']);
  });

  it('listas: índice, tamanho e métodos', () => {
    expect(
      printed(`
        let list = [10, 20]
        list.push(30, 40)
        list[0] = 5
        list[list.length] = 50
        let last = list.pop()
        let first = list.shift()
        print(list, list.length, last, first, list.includes(30), list[9])
      `),
    ).toEqual(['[20, 30, 40] 3 50 5 true null']);
  });

  it('funções: retorno, recursão, closures e hoisting', () => {
    expect(
      printed(`
        print(fact(5))
        function fact(n) {
          if (n <= 1) { return 1 }
          return n * fact(n - 1)
        }
        function counter() {
          let count = 0
          function next() { count++; return count }
          return next
        }
        let c = counter()
        c(); c()
        print(c())
        function nothing() { return }
        print(nothing())
      `),
    ).toEqual(['120', '3', 'null']);
  });

  it('função pode chamar ações e pausar no meio', () => {
    const { actions } = runScript(`
      function walk(n) { for (let i = 0; i < n; i++) { forward() } }
      walk(2)
      turnLeft()
    `);

    expect(kinds(actions)).toEqual(['forward', 'forward', 'turnLeft']);
  });

  it('escopo de bloco: let dentro do bloco não vaza', () => {
    expect(runtimeError('if (true) { let x = 1 }\nprint(x)').reason).toBe(
      '"x" não foi declarado',
    );
  });

  it('pode sombrear uma função da linguagem num escopo próprio', () => {
    expect(
      printed('let print2 = print\nlet forward = 3\nprint2(forward)'),
    ).toEqual(['3']);
  });
});

describe('ScriptProcess — sensores', () => {
  it('front, back, left e right devolvem casas com tipo, posição e robô', () => {
    const host = new FakeHost();
    host.cells = {
      front: { type: 'robot', x: 0, y: 1, robot: 2 },
      back: { type: 'edge', x: 0, y: -1, robot: null },
      left: { type: 'obstacle', x: -1, y: 0, robot: null },
    };

    const { host: after } = runScript(
      `
      print(type(front()), front().robot, front().isEmpty)
      print(type(back()), type(left()), type(right()), right().isEmpty)
      print(front().position.x, front().position.y, front())
    `,
      { host },
    );

    expect(after.printed).toEqual([
      'robot 2 false',
      'edge obstacle empty true',
      '0 1 robot (0, 1)',
    ]);
  });

  it('self mostra o estado atual do robô a cada leitura', () => {
    const host = new FakeHost();
    const { host: after } = runScript(
      'print(self.id, self.position, self.orientation)\nforward()\nprint(self.position.y, type(self))',
      {
        host,
        answer: () => {
          host.state = { ...host.state, y: 1 };
          return true;
        },
      },
    );

    expect(after.printed).toEqual(['1 (0, 0) north', '1 robot']);
  });

  it('see, cellAt e explored', () => {
    const host = new FakeHost();
    host.visible = [
      { type: 'empty', x: 0, y: 0, robot: null },
      { type: 'robot', x: 1, y: 1, robot: 3 },
    ];

    const { host: after } = runScript(
      `
      for (let cell of see()) {
        if (type(cell) == "robot") { print("robô", cell.robot, "em", cell.position) }
      }
      print(type(cellAt(9, 9)), explored())
    `,
      { host },
    );

    expect(after.printed).toEqual(['robô 3 em (1, 1)', 'unknown 9']);
  });

  it('type() dos outros valores e funções matemáticas', () => {
    expect(
      printed(`
        print(type(1), type("a"), type(true), type(null), type([]), type(print), type(front().position))
        print(abs(-3), floor(2.7), min(4, 2, 8), max(4, 2, 8))
      `),
    ).toEqual(['number string boolean null list function position', '3 2 2 8']);
  });
});

describe('ScriptProcess — erros de execução', () => {
  it.each([
    ['variável não declarada', 'x = 1', /"x" não foi declarado/],
    ['declarar duas vezes', 'let a = 1\nlet a = 2', /já foi declarado/],
    ['alterar função da linguagem', 'forward = 1', /faz parte da linguagem/],
    ['alterar self', 'self = 1', /faz parte da linguagem/],
    ['declarar self', 'let self = 1', /"self" é reservado/],
    ['alterar propriedade', 'front().type = "x"', /só de leitura/],
    [
      'propriedade inexistente',
      'print(front().cor)',
      /não tem a propriedade "cor"/,
    ],
    ['divisão por zero', 'print(1 / 0)', /divisão por zero/],
    ['resto por zero', 'print(1 % 0)', /divisão por zero/],
    ['soma de lista', 'print([1] + 1)', /"\+" precisa de números ou textos/],
    ['subtração de texto', 'print("a" - 1)', /esperava um número/],
    [
      'comparar tipos diferentes',
      'print(1 < "2")',
      /compara dois números ou dois textos/,
    ],
    ['chamar o que não é função', 'let x = 1\nx()', /number não é uma função/],
    ['argumentos a mais na nativa', 'forward(1)', /forward espera 0 argumento/],
    ['argumentos a menos na nativa', 'cellAt(1)', /cellAt espera 2 argumento/],
    [
      'argumentos na função do usuário',
      'function f(a) {}\nf()',
      /f espera 1 argumento/,
    ],
    ['índice não inteiro', 'print([1][0.5])', /esperava um número inteiro/],
    ['índice em número', 'print(5[0])', /não dá para usar \[ \] em number/],
    ['posição fora da lista', 'let l = []\nl[3] = 1', /fora da lista/],
    [
      'índice em texto para alterar',
      'let t = "ab"\nt[0] = "c"',
      /só dá para alterar posições de uma lista/,
    ],
    [
      'for of em número',
      'for (let x of 3) {}',
      /precisa de uma lista ou texto/,
    ],
    ['++ em texto', 'let t = "a"\nt++', /esperava um número/],
    ['min sem argumentos', 'min()', /min espera pelo menos 1/],
    ['shareMap com texto', 'shareMap("2")', /esperava um número/],
    [
      'recursão infinita',
      'function f() { return f() }\nf()',
      /recursão profunda demais/,
    ],
  ])('%s', (_name, source, message) => {
    expect(runtimeError(source).reason).toMatch(message);
  });

  it('o erro diz linha e coluna', () => {
    const error = runtimeError('forward()\n\n  print(y)');

    expect(error.location).toEqual({ line: 3, column: 9 });
    expect(error.message).toBe(
      'Erro na linha 3, coluna 9: "y" não foi declarado',
    );
  });

  it('depois de um erro o programa termina', () => {
    const process = ScriptProcess.compile('print(x)', new FakeHost());

    expect(process.next().kind).toBe('error');
    expect(process.next()).toEqual({ kind: 'finished' });
  });
});

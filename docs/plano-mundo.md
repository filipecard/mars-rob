# Plano — mundo vivo, base, bateria, coleta e melhorias

Estado: decisões fechadas em 2026-11-24; fases A–F feitas; `npm run check` passou. Os números abaixo são **propostas** e vão para o arquivo de
configuração, para ajustar sem mexer no código.

Decisões já tomadas:

- Por padrão há 1 robô. Vários robôs continuam funcionando, mas não são o foco.
- O mapa padrão fica maior.
- O robô tem bateria e volta à base para recarregar e descarregar o que coletou.
- No mapa há itens para coletar, e cada item ocupa um espaço diferente no armazenamento.
- O mundo é procedural e muda com o tempo: árvores crescem e caem, minérios surgem.
- Há melhorias para o robô (bateria, armazenamento, visão, ferramentas) e para a base (armazém).
- Linguagem: igualdade por valor, mensagens de erro melhores e classes do usuário.
- Interface: clique no mapa para pegar a posição, e salvar/carregar a simulação.
- O replay com barra de tempo não entra.

## Fase A — Linguagem — feita (2026-11-24)

Independente do resto, pode ser feita primeiro.

1. **Igualdade por valor:** `==` compara posições e casas pelos campos (`self.position == c.position`).
   Listas e funções continuam sendo comparadas pela identidade.
2. **Mensagens de erro melhores**, por exemplo:
   - `front().isEmpty()` → "isEmpty é um campo, não uma função: use front().isEmpty";
   - nome desconhecido → "x não existe. Você quis dizer y?" (nome parecido);
   - dicas para `not`, `and`, `or`, `===`, `!==`, `var` e `const`.
3. **Classes do usuário:** `class`, `constructor`, `this`, métodos e `new`. Herança (`extends`) fica
   de fora numa primeira versão.

## Fase B — Mapa maior, base e bateria

- **Mapa:** limite padrão 30 (malha 61x61), com mais obstáculos fixos (rochas).
- **Base:** uma casa na origem, onde o robô nasce. Ela não é obstáculo, e só um robô fica nela por vez.
- **Bateria:** começa com 100.

  | Ação                     | Custo |
  | ------------------------ | ----- |
  | passo                    | 1     |
  | giro, `wait()`, sensores | 0     |
  | coletar                  | 1     |
  | minerar                  | 3     |
  | compartilhar mapa        | 1     |

- **Recarga:** na base, `recharge()` devolve 20 de carga por tick.
- **Bateria zerada:** ações que gastam carga falham (devolvem false); parado, o robô recupera 1 de carga a cada 5 ticks sozinho (painel solar), então nunca fica preso para sempre.
- **Linguagem:** `battery()`, `maxBattery()`, `base` (a posição da base).

## Fase C — Itens e armazenamento

- Os itens ficam no chão de uma casa livre (o robô passa por cima) e aparecem no mapa.
- `collect()` pega o item da casa onde o robô está. Se não couber no armazenamento, devolve `false`.
- `unload()` na base descarrega tudo no **armazém da base**, que tem capacidade própria.
- Itens e espaço que ocupam:

  | Item             | Espaço | De onde vem                   |
  | ---------------- | ------ | ----------------------------- |
  | galho            | 1      | cai em volta das árvores      |
  | pedra            | 2      | solta no chão, desde o começo |
  | tronco           | 4      | árvore que caiu               |
  | minério de ferro | 3      | minerar uma jazida            |

- Armazenamento inicial: robô 10, armazém 50.
- **Linguagem:** `inventory()` (lista de itens), `cargo()` / `maxCargo()`, `cell.item`.

## Fase D — Mundo vivo (procedural)

O mundo avança a cada tick do relógio (no servidor, mesmo sem programa rodando; na CLI, enquanto roda ticks), com a mesma semente, então é reproduzível.

- **Árvore:**
  1. surge como muda (obstáculo de 1 casa) numa casa livre;
  2. cresce por estágios e ocupa mais casas em volta (até 3x3);
  3. enquanto vive, solta galhos nas casas livres vizinhas de tempos em tempos;
  4. depois de um tempo, cai: libera as casas e deixa troncos no lugar.
- **Jazida de minério:** surge ao lado das rochas e é um obstáculo. `mine()` minera a casa da frente,
  precisa da ferramenta **picareta** e solta minério de ferro. A jazida se esgota depois de N usos.
- **Pedras:** espalhadas no começo e, às vezes, soltas quando a jazida se esgota.
- **Regras que continuam valendo:** o mundo não pode bloquear o acesso a partes da malha (RN11).
  Nada cresce em cima de robô, da base, de item ou nas casas em volta da base.
- **Mapa escuro:** o robô só percebe uma mudança quando a vê. O mapa dele pode ficar desatualizado
  (por exemplo, uma árvore que caiu fora da visão).

## Fase E — Melhorias e ferramentas

São compradas com o que está no armazém da base, pelo script (`upgrade("battery")`, com o robô na base) ou pelo operador (interface e CLI).

| Melhoria         | Efeito                          | Custo (proposta)     |
| ---------------- | ------------------------------- | -------------------- |
| picareta         | permite `mine()`                | 3 galhos + 2 pedras  |
| bateria +50      | carga máxima                    | 4 ferros + 2 troncos |
| compartimento +5 | armazenamento do robô           | 3 troncos + 2 ferros |
| visão 5x5        | raio da visão passa de 1 para 2 | 6 ferros             |
| armazém +50      | capacidade da base              | 6 troncos + 4 pedras |

Cada melhoria pode ter níveis, com custo crescente.

## Fase F — Interface e persistência

- **Clique no mapa:** clicar numa casa mostra x,y e insere `x, y` no editor, na posição do cursor.
- **Mostrar no front:** bateria, armazenamento, armazém da base, itens no mapa e um painel de melhorias.
- **Persistência:** salvar e carregar a simulação inteira em JSON. Isso inclui o mundo, os robôs, os
  mapas, a base, os scripts e o tick. Vira um `JsonFileSimulationRepository` (pela porta que já existe).

## Ordem sugerida

A (linguagem) → B (base e bateria) → C (itens) → D (mundo vivo) → E (melhorias) → F (interface e
persistência). O clique no mapa (F) é pequeno e pode entrar junto com B.

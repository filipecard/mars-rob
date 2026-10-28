  # Requisitos — Mars Rob

  ## 1. Visão geral
  <!-- 2 ou 3 frases: o que o sistema faz e para quem -->

  ## 2. Glossário
  <!-- Termos do domínio com significado único no projeto.
       Esses nomes vão virar classes, então escolha bem. -->
  - **Malha (Grid):**
  - **Posição (Position):**
  - **Direção (Direction):**
  - **Movimento (Movement):**
  - **Comando:** <!-- a string inteira, ex.: "NLLSSSS" -->

  ## 3. Regras de negócio
  <!-- Numere: RN01, RN02... Os testes vão citar esses números. -->
  - RN01 — Posição inicial: 0,0 (x, y)
  - RN02 — Tamanho da malha e intervalo de coordenadas: ponto maximo (15,15) ponto minimo (-15,-15), ponto central (0,0)
  - RN03 — Efeito de cada direção sobre x/y: ( N = + y; S = -y; L = + x; O = -x)
  - RN04 — Comportamento ao tentar sair da malha: alerta que a ação não pode ser executada, pois ultrapassa o limite da região;
  - RN05 — A posição persiste entre comandos? Sim, a posição fica fixada;

  ## 4. Formato da entrada
  <!-- Defina a gramática: o que é válido e o que é inválido -->
  - Formato: letras sem espaço, letras validas NSLO ex:  N; NLL; NLSO;  é invalido: 1X; L L; N1; XXX;
  - Quantidade de passos (mínimo/máximo, múltiplos dígitos?): sem limite de passos, contanto que não saia do limite da malha;
  - Letras aceitas (maiúsculas/minúsculas?): NSLO, maiusculas;
  - Espaços: sem espaços;

  ## 5. Formato da saída
  - Sucesso: Posição atual ( X: 10, Y: 20)
  - Erro de entrada inválida: Tipo de entrada invalido, permitido apenas as letras (N,S,L,O)
  - Erro de limite da malha: O robô não pode sair do limite do planeta;

  ## 6. Critérios de aceite
  <!-- Dado / Quando / Então. Inclua casos felizes, bordas e erros. -->

  ### CA01 — Movimento simples
  - **Dado** o robô em (0,0)
  - **Quando** receber "N"
  - **Então** deve estar em (0,1)

  ### CA02 — ...

  ## 7. Fora do escopo
  <!-- O que o sistema NÃO faz (por enquanto). Evita que o escopo cresça sem você perceber. -->
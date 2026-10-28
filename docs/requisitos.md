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
  - **Comando:** <!-- a string inteira, ex.: "1N2L4S" -->

  ## 3. Regras de negócio
  <!-- Numere: RN01, RN02... Os testes vão citar esses números. -->
  - RN01 — Posição inicial:
  - RN02 — Tamanho da malha e intervalo de coordenadas:
  - RN03 — Efeito de cada direção sobre x/y:
  - RN04 — Comportamento ao tentar sair da malha:
  - RN05 — A posição persiste entre comandos?

  ## 4. Formato da entrada
  <!-- Defina a gramática: o que é válido e o que é inválido -->
  - Formato:
  - Quantidade de passos (mínimo/máximo, múltiplos dígitos?):
  - Letras aceitas (maiúsculas/minúsculas?):
  - Espaços:

  ## 5. Formato da saída
  - Sucesso:
  - Erro de entrada inválida:
  - Erro de limite da malha:

  ## 6. Critérios de aceite
  <!-- Dado / Quando / Então. Inclua casos felizes, bordas e erros. -->

  ### CA01 — Movimento simples
  - **Dado** o robô em (0,0)
  - **Quando** receber "1N"
  - **Então** deve estar em (0,1)

  ### CA02 — ...

  ## 7. Fora do escopo
  <!-- O que o sistema NÃO faz (por enquanto). Evita que o escopo cresça sem você perceber. -->
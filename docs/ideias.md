# Ideias para depois

Ideias anotadas para evoluir o projeto. Nenhuma está implementada.

1. **Comando `ir x,y`**: o robô calcula sozinho o caminho até a posição, desviando dos obstáculos
   (busca em largura; o `Grid` já tem uma BFS para a RN11 que pode ser reaproveitada).
2. **Comando `explorar`**: o robô anda sozinho até a fronteira mais próxima do que ainda é
   desconhecido, até revelar o mapa inteiro. Combina com vários robôs dividindo a exploração.
3. **Objetivos**: amostras escondidas no mapa escuro, com contador de coletadas (vira um mini-jogo).
4. **Bateria**: cada passo gasta energia; o comando é rejeitado quando ela acaba.
5. **Persistência** (`JsonFileFleetRepository`) e **desfazer/histórico**: mostram para que serve a
   porta de repositório da camada de aplicação.
6. **Outra interface (API HTTP ou web)**: trocar só a camada `presentation`, provando que o resto
   da Clean Architecture não muda.

## Implementado depois desta lista

- Missões simples e estatísticas de exploração, itens e melhorias na interface web.
- Terrenos de areia (passos custam 2 de bateria) e gelo (passos não gastam bateria), gerados no mundo.
- Mensagens entre robôs próximos, com histórico curto enquanto o servidor estiver ligado.
- Planejamento de rotas pela interface, usando apenas casas livres já conhecidas pelo robô.
- Nome e cor personalizados para cada robô, guardados no navegador.

Replay, editor de cenários, desafios de programação e novos tipos de robôs continuam fora do escopo atual.

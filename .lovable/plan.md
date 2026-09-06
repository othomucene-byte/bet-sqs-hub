# Aviator e Fish — painel compacto e automações reais

Objetivo: aproximar os dois jogos da referência no telemóvel, corrigir o movimento visual do Aviator e tornar os dois modos automáticos realmente funcionais, sem alterar o resultado das rondas, o saldo ou a liquidação controlados pelo servidor.

## Painel de apostas compacto

- Reduzir alturas, margens, títulos e tamanhos dos controlos para que os dois painéis fiquem compactos e estáveis em 390×710, como na referência.
- Manter em cada painel: seletor `− / valor / +`, quatro valores rápidos, botão principal e os dois controlos automáticos.
- Usar a mesma estrutura, medidas e cores no Aviator e Fish; no telemóvel, painéis empilhados sem deslocamentos horizontais ou conteúdo cortado.
- Manter aposta mínima real de 3 MZN e trocar os valores rápidos para `3 / 5 / 10 / 20`.
- Compactar também separadores e totais inferiores, eliminando informação repetida e preservando a leitura.

## Aviator: fundo fixo e voo coerente

- Fixar completamente a imagem de fundo do Aviator: sem pan, zoom ou deriva durante a ronda.
- Manter apenas avião, rasto, curva e partículas em movimento.
- Recalibrar a progressão visual para o avião não chegar perto do limite do palco aos 4,5x/5x; reservar a aproximação à borda para multiplicadores muito superiores.
- Garantir que a posição é sempre derivada do multiplicador mostrado, sem alterar a matemática nem o instante real do crash.
- Preservar o comportamento submarino próprio do Fish, mas usar a mesma escala visual coerente do multiplicador.

## Levantamento automático real

- Manter o valor-alvo por painel e validá-lo antes da aposta.
- Enviar o alvo ao servidor juntamente com a aposta, como já acontece.
- Confirmar visualmente quando está ativo e bloquear alterações depois de a aposta entrar.
- Mostrar no painel o levantamento confirmado pelo servidor; nunca calcular ou creditar prémios no navegador.
- Ajustar a liquidação para só pagar quando o alvo foi realmente atingido antes do crash, mantendo idempotência e ledger.

## Jogo automático por número de rondas

- Ao ativar, mostrar um contador compacto de rondas e permitir escolher quantas rondas repetir em cada painel.
- Colocar automaticamente a mesma aposta no respetivo painel quando abrir uma nova ronda.
- Decrementar apenas depois de o servidor confirmar a aposta.
- Parar ao concluir o número escolhido, ao utilizador desligar, quando faltar saldo, quando o valor for inválido ou quando o servidor devolver erro.
- Impedir duplicação em atualizações/polling repetidos e manter os dois painéis independentes.
- O servidor continua a validar cada aposta, o estado da ronda e o saldo; o automatismo do ecrã nunca cria crédito nem decide resultados.

## Ficheiros previstos

- `src/components/games/bet-pad.tsx`: composição compacta, escolhas rápidas e controlos automáticos.
- `src/components/games/game-chrome.tsx` e `src/components/crash/round-stats.tsx`: área inferior compacta e consistente.
- `src/routes/_authenticated/crash.tsx` e `src/routes/_authenticated/fish.tsx`: execução segura do jogo automático, contador de rondas e estados por painel.
- `src/lib/games/stage.ts` e temas dos dois jogos: fundo fixo do Aviator e nova escala de posição.
- `src/styles.css`: apenas os ajustes necessários nos tokens de jogo.
- Migração de correção da liquidação automática, caso a condição de limite precise ser atualizada no backend.

## Verificação

- Testar Aviator e Fish em 390×710 e desktop, incluindo apostas simultâneas nos dois painéis.
- Verificar jogo automático por várias rondas, paragem manual, saldo insuficiente e prevenção de aposta duplicada.
- Verificar levantamento automático abaixo, igual e acima do multiplicador de crash, conferindo aposta, prémio e ledger no servidor.
- Capturar o Aviator durante uma ronda para confirmar fundo imóvel e posição coerente em 2x, 4,5x, 5x e valores superiores.
- Confirmar ausência de erros de execução e compilação.

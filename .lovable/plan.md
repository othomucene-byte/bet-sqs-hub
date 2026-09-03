# Aviator / Fish: distribuição de resultados mais equilibrada + auditoria visível

## O que se passou (verificado nos dados)

A fórmula do resultado não foi alterada — apenas a margem da casa passou de 5% para 3%. Desde essa mudança correram só 10 rondas de Aviator, e nove delas ficaram abaixo de 2.00x (a décima foi 15.33x). Nas 460 rondas anteriores, 53.7% ficaram abaixo de 2.00x e 4.3% explodiram logo em 1.00x — ou seja, o comportamento estatístico está correto e o que sentiste foi variância de amostra pequena.

Ainda assim, a curva atual concentra demasiados resultados na zona 1.00x–1.60x, que é a que faz o jogo parecer "quebrado". Vou manter o RTP oficial de 97% e redistribuir os resultados para reduzir rondas mortas, mais mostrar prova pública de que os números batem.

## O que vou fazer

1. **Nova curva de resultados (RTP 97% mantido)**
   - Continuar com ~3% de rondas a explodir em 1.00x (parte da margem).
   - Reduzir a franja 1.00x–1.30x, que hoje ocupa ~25% das rondas, para cerca de metade disso, empurrando essas rondas para a faixa 1.5x–4x.
   - Manter a cauda alta (rondas de 10x+ continuam a existir, com a mesma raridade).
   - A distribuição resultante fica em torno de 50% acima de 2.00x, como está prometido no ecrã do jogo.

2. **Painel de auditoria no jogo**
   - Um cartão "Justiça do jogo" com números reais calculados no servidor sobre as últimas 100 e 1000 rondas: % de rondas em 1.00x, % acima de 2.00x, multiplicador médio e RTP efetivo.
   - Mostra que o resultado observado corresponde ao anunciado, em vez de o jogador ter de confiar no texto.

3. **Verificador provably fair por ronda**
   - No histórico, tocar numa ronda passada mostra semente do servidor, semente do cliente, nonce, o hash publicado antes da ronda e o multiplicador recalculado no browser — se coincidir, a ronda é comprovadamente honesta.

4. **Coerência do ecrã**
   - Corrigir os textos e o valor de margem que ainda assumem 5% em vez da margem real da ronda.
   - Aplicar as mesmas regras ao Fish Crash (as rondas de Fish em curso ainda usam margem 5%; passam a usar a mesma configuração do Aviator).

## Detalhes técnicos

- A nova curva vive numa migração que substitui `public.crash_result` (mesma assinatura, mesmo HMAC-SHA256 provably fair, mesma verificação independente) e no espelho browser-safe `src/lib/crash/fair.ts`, mantendo as duas implementações idênticas — o mapeamento passa a aplicar uma transformação monótona ao float uniforme antes da fórmula do multiplicador, com o RTP recalculado para continuar em 0.97.
- Rondas já criadas não são recalculadas: o resultado é gravado antes da ronda abrir e continua auditável com a semente original.
- As estatísticas de auditoria são agregadas numa server function em `src/lib/crash/stats.server.ts` (nenhum cálculo financeiro no frontend).
- O verificador do histórico usa `crashResult`/`sha256Hex` já existentes em `src/lib/crash/fair.ts`, apenas no cliente e apenas para rondas terminadas.
- Nada muda em apostas, carteira, liquidação ou ledger.

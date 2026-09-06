# Promoções: bónus de primeiro depósito + apostas grátis por perdas

Duas promoções reais, com carteira de bónus separada, limites claros e tudo decidido no servidor. O navegador nunca credita nem liberta bónus.

## 1. Bónus do primeiro depósito (FIRST_DEPOSIT_20)

- No primeiro depósito confirmado, o jogador recebe 20 MZN na **Carteira Bónus**.
- Uma única vez por utilizador (garantido por registo único, não por verificação no ecrã).
- O bónus é **apenas jogável**: nunca é sacável. Os ganhos das apostas feitas com bónus vão para o saldo real de apostas.
- Expira em 7 dias se não for usado.
- Só conta o depósito confirmado pelo gateway — nada é creditado por tentativa ou por pedido pendente.

## 2. Quatro apostas grátis por perdas (LOSS_RECOVERY_4)

- Elegibilidade: perdas confirmadas de **200 MZN ou mais no mesmo dia** (Maputo).
- Recompensa: **4 apostas grátis**, cada uma de valor livre entre **3 e 10 MZN**.
- Frequência: **no máximo 1 recompensa por semana** por utilizador.
- Validade: **24 horas** após a atribuição; depois expiram automaticamente.
- Utilizáveis no **Aviator, Fish e em bilhetes simples de Desportos**.
- A aposta grátis não devolve o valor da entrada: se ganhar, o jogador recebe apenas o lucro (valor × multiplicador − valor), que entra no saldo real.
- Protecção contra abuso: só contam apostas reais liquidadas (nunca apostas já feitas com bónus), e há limite máximo de recompensas por período.

## Onde o jogador vê isto

- Nova página **Promoções** (`/promocoes`) com as duas promoções, regras em linguagem simples, estado de elegibilidade e aviso de jogo responsável.
- Na **Carteira**: novo cartão "Saldo bónus" com o valor jogável e a data de expiração.
- Nos painéis do **Aviator/Fish** e no bilhete de **Desportos**: quando existem apostas grátis válidas, aparece um selecionador "Usar aposta grátis" que fixa o valor entre 3 e 10 MZN.
- Nas **Notificações**: aviso quando o bónus é creditado e quando as apostas grátis são atribuídas ou expiram.
- No **Admin**: lista de promoções com possibilidade de activar/desactivar, e histórico de bónus atribuídos e usados.

## Regras de comunicação

Nunca prometer ganhos. Textos sempre com o limite, a validade e a condição de utilização visíveis, mais a nota de jogo responsável.

---

## Detalhes técnicos

Migração (com GRANTs, RLS e políticas por `auth.uid()`):

- `promotions` — código, tipo, parâmetros em `jsonb`, `active`, janelas de vigência. Registos iniciais: `FIRST_DEPOSIT_20`, `LOSS_RECOVERY_4`.
- `bonus_wallets` — carteira de bónus por utilizador (saldo jogável, moeda, estado). Separada de `wallets`.
- `bonus_transactions` — ledger append-only do bónus (trigger `reject_ledger_mutation`), `reference` única para idempotência.
- `bonus_grants` — atribuições por promoção/utilizador, com `unique (user_id, promotion_id)` para o primeiro depósito e `expires_at`.
- `free_bets` — aposta grátis individual: `min_amount` 3, `max_amount` 10, `status` (`available|used|expired`), `expires_at`, `used_bet_id`.
- `loss_streaks` — agregado diário por utilizador (`day`, `lost_amount`, `lost_count`), alimentado na liquidação.

Funções `security definer`:

- `grant_first_deposit_bonus(_user_id, _payment_reference)` — idempotente por referência; chamada dentro do fluxo do webhook NetShop após o `wallet_apply` do depósito, só se for o primeiro depósito confirmado.
- `record_bet_loss(_user_id, _amount)` — chamada por `settle_round` e `resolve_bet_slips`; actualiza `loss_streaks` do dia e avalia elegibilidade.
- `maybe_grant_loss_recovery(_user_id)` — se perdas do dia ≥ 200 e não houve recompensa nos últimos 7 dias, cria 4 `free_bets` (24h) + notificação.
- `use_free_bet(_user_id, _free_bet_id, _amount, _context)` — valida intervalo 3–10, validade e estado; marca `used`; devolve token para a aposta.
- `expire_bonuses()` — marca bónus/apostas grátis expirados; chamada por rota cron em `src/routes/api/public/cron/bonus-expiry.ts` protegida por `LOVABLE_CRON_SECRET`.

Alterações a funções existentes: `place_bet` e `place_bet_slip` aceitam `_free_bet_id` opcional — quando presente não debitam a carteira real, marcam a aposta como bónus; nos pagamentos, aposta grátis paga só o lucro. `settle_round`/`resolve_bet_slips` passam a chamar `record_bet_loss`.

Frontend: `src/lib/promotions/promotions.functions.ts` (`getPromotions`, `getBonusSummary`, `listFreeBets`, `claimLossRecovery`), rota `src/routes/_authenticated/promocoes.tsx`, cartão de bónus em `carteira.tsx`, selector de aposta grátis em `src/components/games/bet-pad.tsx` e `src/components/sports/slip-panel.tsx`, secção de promoções em `admin.tsx`, e link no `site-header.tsx`.

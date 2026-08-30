# BETFCOM SQs — Arquitetura Crash + Wallet + NetShop

Documento de implementação. Estado atual: **backend não provisionado** (Lovable Cloud
bloqueado por falta de créditos no workspace). Nada aqui está ativo em produção; o
frontend não simula saldos, rondas nem pagamentos.

## Princípio não negociável

O frontend nunca decide resultado, saldo, cash-out ou estado de pagamento. O servidor
é a única autoridade. O cliente recebe eventos e envia intenções (`place_bet`,
`cashout`), nunca valores de resultado.

## Ordem de implementação

1. Ativar Lovable Cloud (bloqueado).
2. Aplicar `docs/sql/001_wallet_ledger.sql` — wallets + ledger append-only + `wallet_apply`.
3. Aplicar `docs/sql/002_crash_game.sql` — rondas, apostas, `crash_result`.
4. Motor de rondas no servidor (server functions + estado persistido em `game_rounds`).
5. Aposta e cash-out atómicos via `wallet_apply`.
6. Webhooks NetShop (C2B depósito, B2C payout) com HMAC-SHA256 e idempotência.
7. Admin/backoffice com RBAC (`user_roles` + `has_role`).
8. UI do jogo (animação) só no fim.

## Wallet e ledger

- `wallets.balance` só muda dentro de `wallet_apply`, que faz `SELECT ... FOR UPDATE`
  na carteira e insere a linha de ledger na mesma transação.
- `wallet_transactions` é append-only (trigger rejeita UPDATE/DELETE).
- `reference` é a chave de idempotência. Convenções:
  - depósito: `dep:<netshop_transaction_id>`
  - payout: `wd:<withdrawal_id>:<estado>`
  - aposta: `bet:<bet_id>`
  - prémio: `win:<bet_id>`
- Carteira de apostas e carteira de investimentos são linhas distintas (`kind`),
  contabilisticamente separadas.

## Depósito (NetShop C2B)

```
cliente → server fn createDeposit → NetShop charge → checkout/USSD
       → webhook assinado → verificar HMAC → wallet_apply('deposit', +valor)
```

- O ledger recebe `pending` no início e a **confirmação só vem do webhook**.
- Taxa ao cliente: **0 MZN**. O cliente pede 1.000 → recebe 1.000 na wallet.
- A comissão C2B da NetShop (atualmente publicada em 10%) é **custo da plataforma**,
  registada como `adjustment` numa conta de custos, nunca descontada ao cliente.
  Este custo tem de ser negociado/absorvido — não é margem zero para a Betfcom.

## Levantamento (NetShop B2C)

```
pedido → verificar saldo → reservar (balance -valor, reserved +valor, ledger 'withdrawal' pending)
      → NetShop payout → webhook
         ├── sucesso  → reserved -valor, ledger completed
         └── falha    → refund: balance +valor, reserved -valor, ledger 'refund'
```

Estados: `pending → processing → completed | failed | cancelled`. O dinheiro nunca sai
definitivamente antes da confirmação do payout.

## Crash — ciclo da ronda

`WAITING → BETTING → RUNNING → CRASHED → SETTLED`

- Antes de `BETTING`: servidor gera `server_seed`, publica `SHA256(server_seed)` e fixa
  `client_seed` + `nonce = round_number`. O `crash_multiplier` é calculado e guardado
  já nesta fase — a ronda não pode ser influenciada depois de aberta.
- Em `BETTING`: apostas aceites; `wallet_apply('bet', -amount)`.
- Em `RUNNING`: broadcast do multiplicador por WebSocket. O cliente apenas mostra.
- Em `CRASHED`: `server_seed` é revelado; apostas ativas passam a `lost`.
- Em `SETTLED`: ledger fechado para a ronda; nada mais é escrito.

## Cash-out

Validações obrigatórias no servidor, por esta ordem: sessão autenticada → aposta existe
→ pertence ao utilizador → `status = 'active'` → ronda em `RUNNING` → multiplicador atual
< `crash_multiplier`. Só então:

```
payout = amount × multiplicador_do_servidor
game_bets → cashed_out (UPDATE ... WHERE status = 'active' garante uma só vez)
wallet_apply('win', +payout, reference = 'win:<bet_id>')
```

O multiplicador usado é o do servidor, derivado do tempo decorrido da ronda — nunca o
enviado pelo cliente. Duplo-clique ou reconexão são absorvidos pela `reference` única.

## Provably fair

`multiplicador = max(1, (1 - houseEdge) / (1 - float))`, onde `float` vem dos primeiros
32 bits de `HMAC_SHA256(server_seed, client_seed:nonce)`. Com `float < houseEdge` o
resultado é crash instantâneo em 1.00x.

O jogador verifica após a ronda: confirma `SHA256(server_seed)` contra o hash publicado
e recalcula o multiplicador. Ver `crash_result()` em `002_crash_game.sql`.

## House edge

`houseEdge = 0.05` está **dentro da fórmula do resultado (RTP)**, não subtraído do
cash-out. Depósito, levantamento e cash-out têm 0% de taxa para o cliente. A vantagem da
casa é estatística e documentada, e é compatível com provably fair.

## Admin

Papéis em tabela própria (`user_roles` + `has_role` security definer) — nunca no perfil.
Vistas: rondas, apostas, cash-outs, depósitos, levantamentos, saldos, transações NetShop,
reconciliação, logs e auditoria. Todos os totais vêm do ledger, não de contadores soltos.

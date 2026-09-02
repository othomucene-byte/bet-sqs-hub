# SQs Investimentos — evolução modular (add, don't break)

## 1. O que já existe e será preservado intacto

**Autenticação** — Supabase Auth, `/auth`, `profiles`, `user_roles` (`player`/`admin`), `has_role()`, trigger `handle_new_user`, layout protegido `_authenticated/route.tsx`. Nada muda.

**Wallet + Ledger** — `wallets` (kinds `betting` e `investment`), `wallet_transactions` append-only (triggers `reject_ledger_mutation`), função atómica `wallet_apply` com lock pessimista e idempotência por `reference`. Mantido como fonte única de verdade do dinheiro.

**Pagamentos NetShop** — `payment_intents`, `netshop.server.ts` (charges/payouts, `Idempotency-Key`, wallet ID por método), webhook `/api/public/webhooks/netshop` com HMAC-SHA256. Nenhum endpoint, secret ou fluxo será alterado.

**SQs Apostas** — `game_rounds`, `game_bets`, `place_bet`, `cashout_bet`, `settle_round`, ecrãs `/crash` e `/fish`. Zero alterações.

**Investimentos (base já existente)** — `companies` (10 empresas reais), `investment_products`, `investments`, `company_applications`, RPC `place_investment`/`cancel_investment`, páginas `/investimentos`, `/empresas`, `/carteira`. Serão **reutilizados e estendidos**, nunca recriados.

**Ausente hoje** (a construir): KYC, ordens, posições/valorização, rendimentos, resgates, documentos, notificações, risco e painel admin (não existe nenhum painel admin — será criado novo, não duplicado).

## 2. O que será reutilizado sem tocar

`wallets`, `wallet_transactions`, `wallet_apply`, `payment_intents`, webhook NetShop, `has_role`, `investment_products`, `investments`, `companies`, `profiles`.

## 3. O que será criado (apenas adições)

### Migração 1 — KYC e perfil do investidor
- `kyc_profiles` (user_id único, nome completo, documento tipo/número, data de nascimento, morada, província, nacionalidade, perfil de risco, `status`: not_started/pending/approved/rejected, notas de revisão).
- `kyc_documents` (referência ao perfil, tipo, caminho de ficheiro, estado). Bucket privado de storage `kyc`.
- RLS: cada utilizador lê/escreve o próprio registo enquanto `pending`; admin lê e decide via `has_role`.

### Migração 2 — Ordens, posições, rendimentos, resgates
- `investment_orders` — `user_id`, `product_id`, `investment_id` (nullable), `side` (buy/redeem), `amount`, `currency`, `status` (PENDING/PROCESSING/EXECUTED/PARTIALLY_EXECUTED/CANCELLED/FAILED/REDEEMED), `idempotency_key` único, `reference`, `metadata`, timestamps.
- `investment_order_events` — histórico append-only de cada transição de estado.
- `investment_positions` — capital investido, valor atual, resultado acumulado por (user, product); alimentada só por eventos do servidor.
- `investment_returns` — rendimento ou prejuízo *declarado* por período (valor, tipo PROFIT/LOSS, período, `reference` idempotente). Sem geração automática de lucro e sem promessa de retorno.
- `investment_redemptions` — pedidos de resgate com estados e ligação à ordem.
- `investment_documents` — documentação por produto (ficha, termos, risco).
- `notifications` — mensagens por utilizador (investimento, pagamento, KYC), lidas/não lidas.
- Colunas **adicionadas** a `investments` com defaults seguros: `order_id`, `principal`, `accrued_return`, `redeemed_at`. Nenhuma coluna removida ou alterada de tipo.
- Colunas **adicionadas** a `investment_products`: `max_amount`, `rules` (jsonb), `variable_return` (bool). Sem alterar as existentes.
- Extensão do enum de tipos do ledger para aceitar `investment_redemption`, `profit`, `loss`, `fee`, `reversal` (o `type` é `text` com check — o check é substituído por um superconjunto, migração não destrutiva).
- Grants explícitos + RLS por dono em todas as novas tabelas; políticas de admin via `has_role`.

### Migração 3 — Funções atómicas
- `place_investment_order` (idempotente por `idempotency_key`): valida KYC aprovado, mínimos/máximos, saldo, cria ordem → executa → `wallet_apply('investment_buy')` → posição.
- `redeem_investment` — resgate com validação de estado; devolve capital + rendimento já registado, via `wallet_apply`.
- `post_investment_return` (só admin/serviço) — registra PROFIT/LOSS declarado no ledger e na posição.
- Todas SECURITY DEFINER, `EXECUTE` revogado de `anon`/`authenticated`, chamadas apenas por server functions verificadas.

### Server functions (novas, ficheiros novos)
- `src/lib/investments/kyc.functions.ts` — submeter/ler KYC, upload de documento.
- `src/lib/investments/orders.functions.ts` — criar ordem, listar ordens, cancelar, resgatar.
- `src/lib/investments/portfolio.functions.ts` — património, capital, valor atual, resultado, rentabilidade, extrato.
- `src/lib/admin/admin.functions.ts` — leituras e ações administrativas, cada uma verificando `has_role(admin)` no servidor.
- `getPortfolio`, `invest`, `cancelInvestment`, `transferToInvestment` existentes ficam **como estão** (compatibilidade), passando a delegar internamente nas novas ordens.

### Ecrãs novos (design system atual, sem redesenhar nada)
- `/investimentos/dashboard` — património, investido, rendimento, em processamento, gráficos.
- `/investimentos/portfolio`, `/investimentos/ordens`, `/investimentos/extrato`, `/investimentos/rendimentos`, `/kyc`, `/notificacoes`.
- `/admin` + subsecções (dashboard, clientes, KYC, produtos, investimentos, ordens, rendimentos, resgates, depósitos, levantamentos, reconciliação, risco, auditoria), protegido por `has_role` no servidor.
- Navegação: itens **adicionados** ao header/menu existente; `/carteira`, `/pagamentos`, `/crash`, `/fish` mantêm-se.

## 4. Riscos e como são mitigados

| Risco | Mitigação |
| --- | --- |
| Alterar o check de `wallet_transactions.type` | Substituído por superconjunto que inclui todos os valores atuais; nenhuma linha existente fica inválida |
| Colunas novas em tabelas em uso | Todas nullable ou com default; nenhum `NOT NULL` retroativo |
| Duplicação de ordens/pagamentos | `idempotency_key` único + `wallet_apply` idempotente por `reference` |
| Saldo divergente | Nenhuma escrita direta em `wallets`; tudo por `wallet_apply` |
| Regressão nas apostas/pagamentos | Nenhum ficheiro de crash/fish/netshop é editado; verificação final com build, typecheck e navegação autenticada real |

## 5. Ordem de execução

1. Migração 1 (KYC) → 2 (ordens/posições/rendimentos/resgates/notificações) → 3 (funções).
2. Server functions novas.
3. Ecrãs de investidor.
4. Painel admin.
5. Verificação: build + typecheck + testes de fluxo (login, wallet, depósito, levantamento, webhook duplicado, aposta, ordem, resgate, saldo insuficiente, cancelamento) e revisão do linter de segurança.

Nada é apagado, nada é substituído: o módulo entra ao lado do que já funciona.

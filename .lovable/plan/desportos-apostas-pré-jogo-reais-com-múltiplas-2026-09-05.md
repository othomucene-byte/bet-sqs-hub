# Desportos — apostas pré-jogo reais com múltiplas

Nova área **Desportos** com jogos e cotações reais atualizadas (The Odds API), bilhete simples e múltiplo, e liquidação automática pelos resultados oficiais. A carteira de apostas, o registo imutável e a autoridade do servidor continuam exatamente como hoje.

## Chave necessária

A área só funciona com uma chave própria da The Odds API (the-odds-api.com). Vou pedir-lha durante a implementação e guardá-la só no servidor. Sem chave, a página mostra claramente "Desportos não configurado" — nunca cotações inventadas.

## O que o utilizador vê

- Novo item **Desportos** no menu (topo e menu lateral) e destaque na página inicial.
- Lista de desportos com jogos: Futebol (Premier League, La Liga, Serie A, Champions), Basquetebol, Ténis — filtráveis por competição e por dia.
- Cada jogo mostra hora de início, equipas e cotações: 1X2, Dupla Chance, Mais/Menos golos e Ambas Marcam (quando o fornecedor as der).
- **Bilhete** lateral/inferior: toca nas cotações para adicionar seleções.
  - Simples: uma seleção, um valor.
  - Múltipla: várias seleções, cotação combinada e ganho potencial calculado.
  - Aposta de 3 até 25 000 MZN, igual aos outros jogos.
- Após confirmar: bilhete com referência, estado (Em aberto, Ganho, Perdido, Anulado) e histórico em **Os meus bilhetes**.
- Aviso de risco visível; nada de retorno prometido.

## Regras que o servidor garante

- A cotação válida é sempre a que o servidor tinha no momento do registo — se mudou, a aposta é recusada com aviso ("cotação alterada") e o utilizador reconfirma.
- Jogo já começado ou suspenso não aceita apostas.
- O valor sai da carteira de apostas no mesmo instante, num único movimento atómico com lançamento no registo.
- Limite de ganho potencial por bilhete e máximo de seleções por múltipla, para controlar risco.
- Ganhos creditados só na liquidação, pelo servidor.

## Atualização e liquidação automáticas

- Um endpoint interno protegido busca jogos e cotações do fornecedor a cada poucos minutos e guarda-os na base de dados; a app lê sempre a nossa base, nunca o fornecedor diretamente.
- O mesmo mecanismo busca resultados finais e liquida: cada seleção passa a ganha/perdida, o bilhete é resolvido (múltipla perde com uma falha, ganha só com todas certas) e o pagamento entra na carteira via o mesmo movimento atómico do resto da plataforma.
- Jogo cancelado/adiado: seleção anulada (cotação 1.00) e, se todo o bilhete for anulado, devolução do valor.
- No painel de administração: ver bilhetes, exposição em aberto, forçar nova sincronização e anular/liquidar manualmente um jogo em caso de erro do fornecedor.

## Detalhes técnicos

Base de dados (nova migração, com GRANT + RLS):
- `sports`, `sport_competitions`, `sport_events` (estado, início, equipas, resultado), `sport_markets`/`sport_odds` (cotação por seleção, com histórico da última atualização) — leitura pública `anon/authenticated`, escrita só `service_role`.
- `bet_slips` (user_id, tipo simples/múltipla, stake, cotação total, ganho potencial, estado, referência, idempotency_key) e `bet_selections` (slip_id, event_id, mercado, seleção, cotação registada, resultado) — leitura só do próprio dono; escrita apenas via RPC.
- RPCs `security definer`: `place_bet_slip(...)` (valida cotação, evento aberto, limites, debita via `wallet_apply`), `settle_sport_event(...)` e `void_sport_event(...)` (resolvem seleções, bilhetes e creditam via `wallet_apply`), com triggers a rejeitar mutações diretas, como no ledger atual.

Código:
- `src/lib/sports/odds.server.ts` — cliente da The Odds API (chave lida dentro do handler, sem chave → estado "não configurado").
- `src/lib/sports/sports.functions.ts` — `getSportsCatalog`, `getEvents`, `getMyBetSlips`, `placeBetSlip` (com `requireSupabaseAuth`).
- `src/routes/desportos.tsx` (pública, catálogo e cotações) e `src/routes/_authenticated/bilhetes.tsx` (os meus bilhetes); bilhete em `src/components/sports/*` reutilizando os tokens `--bet-*` já existentes.
- `src/routes/api/public/cron/sports-sync.ts` — sincronização + liquidação, protegida por segredo de cron (o mecanismo já usado em `cron-auth.ts`), agendada por pg_cron.
- Menu: `src/components/site-header.tsx` ganha "Desportos" (público) e "Os meus bilhetes" (com sessão); admin ganha bloco de desportos em `_authenticated/admin.tsx`.

## Verificação

Migração aplicada, sincronização real corrida uma vez com a chave, screenshots a 390px e 1280px do catálogo, bilhete simples e múltiplo, e um evento liquidado de ponta a ponta em ambiente de teste.

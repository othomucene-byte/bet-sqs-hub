# Agente de Pesquisa e Atualização da Betfcom SQs

Transformar a camada de IA atual (que responde de memória, sem pesquisa real) num **agente de pesquisa contínua** com fonte verificável em cada informação, painel de configuração para o administrador e ecrãs de mercado no estilo das três imagens de referência.

## 1. Pesquisa real com fonte (o ponto mais importante)

Hoje o modelo é perguntado "o que sabes sobre esta empresa" — não pesquisa nada e as fontes podem não existir. Passa a:

- usar pesquisa Google ligada ao Gemini (chave própria do projeto, `GEMINI_API_KEY`), que devolve as ligações reais consultadas;
- só aceitar um dado quando existir pelo menos uma ligação real devolvida pela pesquisa; sem ligação, o dado é descartado (não fica pendente);
- guardar a lista completa de fontes consultadas por cada atualização;
- comparar com o registo anterior do mesmo tipo e guardar em texto **o que mudou**;
- quando duas fontes indicarem valores diferentes para o mesmo facto, o registo fica marcado como **inconsistente** e aparece na fila de revisão do administrador, sem ir para o público;
- continua proibido: preços, volumes, cotações ou resultados inventados; a IA nunca toca em saldos, carteira, ordens ou negócios.

## 2. Configuração pelo administrador

Nova área "Agente de IA" na administração do Exchange:

- intervalo: 30 minutos ou 1 hora;
- ligar/desligar o monitoramento;
- escolher as fontes usadas (lista de domínios/sites permitidos, com adicionar/remover);
- escolher quais empresas são monitoradas (interruptor por empresa);
- botão **Atualizar agora** (uma empresa ou todas);
- estado do agente: última execução, próxima execução, execuções recentes, erros, pausa por falta de créditos/chave, botão retomar;
- fila de revisão: aprovar, recusar, ver fonte e ver conflito assinalado.

O agendador passa a correr a cada 30 minutos e o próprio agente respeita o intervalo configurado (salta a execução quando ainda não passou o tempo). Continua com bloqueio de execução única, lote limitado, progresso gravado e corte automático em recusas terminais.

## 3. Ficha de cada empresa

Na página da empresa/instrumento:

- dados atuais (resultados, dividendos, eventos, perfil);
- notícias recentes com ligação à fonte;
- fontes consultadas;
- última atualização e próxima atualização previstas;
- histórico das atualizações da IA, com o que mudou em cada uma;
- gráfico atualizado apenas quando existirem dados de mercado válidos (negócios reais ou preço de referência publicado), com a origem sempre indicada.

O ecrã lê os dados do servidor e refresca-se sozinho, sem edição manual da empresa.

## 4. Ecrãs no estilo das imagens

- **Lista de mercado (estilo Bolsa / imagem 1):** linhas com símbolo, nome, mini-gráfico e variação em verde/vermelho — usada no painel principal do Exchange em telemóvel.
- **Terminal (imagem 2):** empresa em destaque com gráfico grande, painel de compra rápida, livro de ordens, watchlist e resumo da conta.
- **Dashboard (imagem 3):** saldo total, cartões de poder de compra/lucro/ativos/estado, gráfico de evolução, watchlist, atividade recente e bloco de novidades da IA.

Tudo com os valores reais do sistema; onde não houver dado, o ecrã diz porquê em vez de inventar números.

## Detalhes técnicos

- Migração: tabela `ai_agent_config` (intervalo, ativo, fontes permitidas), coluna `ai_monitored` em `exchange_assets`, tabela `ai_run_log` (execução, empresa, itens novos/alterados/descartados, fontes, erro), colunas em `company_data_points` para `sources` (jsonb), `change_summary`, `conflict_note` e estado `conflict`. GRANTs + RLS: leitura pública apenas de dados aprovados e da configuração de intervalo; escrita só service_role/admin.
- `src/lib/ai/gemini.server.ts`: suporte a `tools: [{ google_search: {} }]` e extração de `groundingMetadata` (ligações reais).
- `src/lib/exchange/company-data.server.ts`: reescrito para pesquisa com grounding, deteção de mudança/conflito, escrita de `ai_run_log`.
- `src/lib/exchange/ai-agent.functions.ts`: leitura/escrita da configuração, "atualizar agora", lista de empresas monitoradas, histórico de execuções (admin).
- `src/routes/api/public/cron/exchange-ai.ts`: respeita intervalo configurado e a lista de empresas monitoradas; `pg_cron` passa a `*/30 * * * *`.
- Frontend: `admin.exchange.tsx` (secção do agente), `exchange.index.tsx` (lista/dashboard), `exchange.asset.$symbol.tsx` (ficha com fontes e histórico).
- Verificação: typecheck/build, execução real do agente numa empresa e leitura das fontes devolvidas, mais conferência dos ecrãs em telemóvel e computador.

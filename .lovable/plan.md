# Barra de topo com depósito legível e menu lateral organizado

Só a barra de topo (`SiteHeader`) muda. Nada de novo no backend: o saldo continua a ser lido do servidor pela função já existente e o frontend nunca calcula nada.

## Área de depósito (barra de topo)

Para quem tem sessão, o lado direito passa a ter dois elementos claros e grandes, ao estilo da referência:

- Botão **DEPÓSITO** verde, alto (44px, alvo de toque confortável), texto forte e legível, sempre visível — também no telemóvel. Liga a `/pagamentos`.
- Chip de **saldo** ao lado: ícone de notas + `1,05 MZN` em número grande e negrito + seta. Enquanto carrega mostra `—` em vez de zero.
- Clicar no chip abre um painel de conta com linhas bem separadas e etiquetas em maiúsculas discretas e valores alinhados à direita:
  - Utilizador (email da sessão)
  - Saldo de apostas (MZN)
  - Saldo de investimentos (MZN)
  - Links: Depositar, Levantar, A minha conta, Terminar sessão
- Sem sessão mantém-se Entrar / Criar conta, mas com o botão principal com a mesma altura e legibilidade.

Contraste: usa os tokens já existentes (verde de acção, superfície escura, texto de alto contraste), a funcionar em dark e light. Sem cores fixas nos componentes; se faltar um token para a barra, é adicionado em `src/styles.css`.

## Menu de três traços

Passa a painel lateral que desliza da direita (Sheet), com fecho por toque fora e tecla Esc:

- Topo do painel: saldo em destaque + botão **Depósito** de largura total.
- Itens grandes (48px de altura) com ícone e texto legível, agrupados por secções com título:
  - **Conta** — A minha conta, Carteira, KYC, Notificações
  - **Jogos** — Aviator, Fish Crash
  - **Investimentos** — Investimentos, Empresas, Pagamentos
  - **Plataforma** — Segurança, tema claro/escuro
- Rodapé: Terminar sessão (ou Entrar / Criar conta sem sessão).
- Item da página actual destacado.
- Visitantes só vêem as secções públicas, como hoje.

## Detalhes técnicos

- `src/components/site-header.tsx` — reescrito: botão de depósito, chip de saldo com `DropdownMenu`, menu lateral com `Sheet` (ambos já em `src/components/ui`).
- Saldo: `useQuery` sobre `getWalletBalances` (`src/lib/investments/investments.functions.ts`), chamada apenas quando há sessão, no componente (nunca em loader de rota pública).
- Email: `supabase.auth.getSession()` já usado no ficheiro.
- Terminar sessão: `supabase.auth.signOut()` e navegação para `/`.
- `src/styles.css` — apenas tokens novos se necessários para a barra.

## Verificação

Screenshots via Playwright a 390px e 1280px, com e sem sessão, painel de saldo e menu lateral abertos, mais o log de build limpo.

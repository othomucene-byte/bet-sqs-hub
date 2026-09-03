# Onde está o Painel de Administração

## Situação atual (verificada)

- O painel existe e está em **`/admin`** (`src/routes/_authenticated/admin.tsx`), protegido: só abre com sessão e só mostra dados depois de o servidor confirmar `has_role(admin)` via `amIAdmin`.
- Não existe **nenhum link** para `/admin` no cabeçalho nem no menu lateral (`src/components/site-header.tsx` e `investor-nav.tsx` não mencionam admin). Ou seja: hoje só se chega lá escrevendo o endereço à mão.

Acesso imediato: com sessão em `othomucene@gmail.com`, abrir `https://betfcom.com/admin` (ou `/admin` no preview).

## O que proponho fazer

Tornar o painel acessível sem decorar o URL, sem o expor a quem não é admin.

1. **Chip de conta no topo** — acrescentar o item "Painel de Administração" ao menu da conta, imediatamente antes de "Terminar sessão".
2. **Menu lateral (três traços)** — nova secção "Administração" no fim, com o item para `/admin`, destacado quando é a página atual.
3. **Visibilidade condicionada** — ambos os itens só são renderizados quando `amIAdmin` devolve `true`; para os restantes utilizadores nada aparece. A autorização continua a ser decidida no servidor, o frontend só esconde/mostra.

## Detalhes técnicos

- `src/components/site-header.tsx`: `useQuery` a `amIAdmin` (`src/lib/admin/admin.functions.ts`) com `enabled: signedIn`, e renderização condicional dos dois itens de navegação.
- Nenhuma alteração em rotas, RLS, funções de servidor ou no próprio `/admin`.

## Verificação

Typecheck, log de build e conferência visual a 390px com e sem sessão de admin.

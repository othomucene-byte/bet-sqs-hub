# Aparecer no Google como "Betfcom SQs" com o seu logo

Objetivo: quando alguém pesquisar "Betfcom", "Betfcom SQs", "apostas", "investimentos" ou "casino em Moçambique", o resultado deve mostrar o nome Betfcom SQs e o logo Betfcom SQs — nunca o ícone da Lovable.

## O que está a causar o ícone errado

O ícone Betfcom SQs já está no projeto, mas ainda falta o ficheiro de ícone no endereço clássico que o Google e o Edge procuram primeiro (`/favicon.ico`). Enquanto esse endereço não existir, os motores de busca continuam a mostrar o ícone antigo que guardaram. Além disso, a versão publicada em betfcom.com ainda é anterior às alterações de marca.

## O que vou fazer

1. Criar o ícone Betfcom SQs também no endereço clássico `/favicon.ico`, em tamanhos 16, 32 e 48 pixéis, para funcionar no Chrome, Google, Edge e restantes.
2. Garantir que a página indica todos os ícones: o clássico, o PNG e o de telefone, todos com a mesma marca Betfcom SQs.
3. Reforçar o nome da marca nos dados que o Google lê: nome "Betfcom SQs", nomes alternativos ("Betfcom", "Betfcom SQs Moçambique") e o logo em imagem quadrada grande, com endereço próprio de logo.
4. Confirmar que cada página pública tem título e descrição próprios com o nome Betfcom SQs (início, investimentos, desportos, casino/Aviator, empresas, pagamentos) e incluí-las todas no mapa do site.
5. Verificar no navegador que os ícones e títulos carregam corretamente.

## Depois de publicar (passo seu)

- Publicar o site, para que betfcom.com passe a servir a nova marca.
- Ligar o Google Search Console ao domínio e submeter o mapa do site; posso ajudar nesse passo. É isso que acelera o Google a substituir o ícone antigo e a mostrar o nome Betfcom SQs. Sem isso, a troca pode demorar semanas.

## Detalhes técnicos

- Gerar `public/favicon.ico` multi-tamanho a partir do PNG de marca existente (ImageMagick), manter `favicon.png` e `apple-touch-icon.png`.
- Em `src/routes/__root.tsx`: adicionar `{ rel: "icon", href: "/favicon.ico", sizes: "any" }` além do PNG; JSON-LD `Organization` com `logo` como `ImageObject` (512x512) e `alternateName` ampliado.
- Revisão de `head()` em cada rota pública; atualizar `public/sitemap.xml` com as rotas públicas que faltem.
- Nenhuma alteração em lógica de saldos, apostas, pagamentos ou base de dados.

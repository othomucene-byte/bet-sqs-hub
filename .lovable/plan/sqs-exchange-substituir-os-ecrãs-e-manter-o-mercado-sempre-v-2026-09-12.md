# SQs Exchange — substituir os ecrãs e manter o mercado sempre visível

## Objetivo

Substituir os ecrãs atuais do SQs Exchange por uma experiência única, densa e profissional, fiel às referências enviadas. O mercado e as empresas aparecem completos desde a abertura, mesmo antes do primeiro negócio, sem inventar operações, volume ou rendimentos.

## Estado confirmado

- O mercado `SQSX-LIVE` está **aberto**, das 08:00 às 20:00 (Maputo), com **11 empresas reais** listadas.
- As 11 empresas têm preço inicial de referência, mas ainda não existem cotações produzidas por negócios nem dados no histórico de mercado.
- A atualização automática das empresas está saudável: última execução concluída às **05:08 de Maputo**, sem falhas, com **43 atualizações aprovadas**.
- O ecrã atual esconde o gráfico e vários indicadores até existirem negócios; essa dependência será removida da apresentação.

## Novo desenho dos ecrãs

### 1. Mercado — painel principal

- Substituir a página atual por um dashboard inspirado nas referências desktop e mobile.
- Desktop: navegação lateral compacta, topo com pesquisa e fundos, resumo do mercado, gráfico principal, tabela de empresas, atualizações recentes e lista acompanhada.
- Mobile: valor do mercado e estado no topo, gráfico imediatamente visível, filtros horizontais e lista compacta de empresas semelhante à referência de portfólio.
- Cada linha mostra logótipo/monograma, símbolo, nome, preço de referência ou último preço, estado, última atualização corporativa e ação clara para abrir a empresa.
- O gráfico fica sempre visível: usa histórico real quando existir e, antes disso, uma linha-base identificada como **Referência**, nunca como negócio ou rendimento.

### 2. Empresa — terminal de investimento

- Ao tocar numa empresa, abrir diretamente um terminal no estilo da referência: identificação e preço no topo, gráfico grande, painel Comprar/Vender, livro de ordens e negócios.
- No telefone, ordem visual: preço e gráfico → Comprar/Vender → indicadores → atualizações da empresa → livro/negócios.
- No desktop, gráfico ao centro, compra/venda à direita, lista de empresas à esquerda e informação densa abaixo.
- Comprar, vender, depositar e levantar continuam ligados às funções reais já existentes, com KYC, saldo, reserva, matching e ledger no servidor.
- Livro e negócios vazios continuam visíveis com estado operacional claro, sem bloquear nem desmontar o terminal.

### 3. Carteira, ordens, negócios, fundos, favoritos e histórico

- Reconstruir todos com a mesma linguagem visual, sem reutilizar a composição antiga.
- Carteira: valor total, gráfico sempre presente, liquidez, posições e composição; sem posições, mantém o painel completo e apresenta empresas disponíveis para investir.
- Ordens: tabela densa com separadores abertas/concluídas/canceladas e cancelamento funcional.
- Negócios: fita profissional com hora de Maputo, empresa, lado, quantidade, preço e liquidação.
- Fundos: saldo da conta, saldo disponível/reservado e ações compactas de Depositar/Levantar.
- Favoritos: lista de empresas acompanhadas com preço, atualização e acesso ao terminal.
- Histórico: visão unificada de ordens, fundos e ledger, com filtros e estados legíveis.

## Dados sempre atualizados, sem fingir mercado

- Separar visualmente três fontes: **Preço de referência**, **Mercado/negócios** e **Atualização da empresa**.
- Usar o preço de referência em todos os cálculos e gráficos de apresentação enquanto não houver último negócio; não fabricar variação, volume, livro ou negócio.
- Guardar revisões verificadas do preço de referência para formar histórico real de referência quando a administração atualizar o valor.
- Expor no resumo de cada empresa a atualização corporativa mais recente, respetiva fonte e hora.
- Manter o trabalho automático de hora a hora e atualizar os ecrãs após cada execução aprovada.
- A IA continua limitada a informação empresarial; não altera saldo, ledger, ordens, negócios nem executa investimento.

## Componentes e comportamento

- Criar uma shell própria do Exchange para desktop e mobile, em vez dos cartões soltos atuais.
- Criar tabela/lista de mercado responsiva, gráfico com modo Referência/Mercado, fita de atualizações e painel de negociação compacto.
- Manter navegação inferior no telefone e navegação lateral no desktop.
- Preservar dark/light mode, tokens Betfcom SQs, português e formatação MZN/horário de Maputo.
- Usar logótipos oficiais apenas quando existir uma fonte verificável; manter monograma profissional onde ainda não houver ficheiro oficial.

## Alterações técnicas

- Ampliar as leituras do mercado para devolver última atualização empresarial e série de preços de referência.
- Criar histórico auditável para revisões de preço de referência, com permissões de leitura pública e escrita apenas administrativa.
- Ajustar a valorização da carteira para usar último negócio ou, na sua ausência, o preço de referência explicitamente marcado.
- Preservar as funções transacionais existentes de ordem, cancelamento, fundos, matching e ledger.
- Não criar liquidez artificial, ordens falsas, negócios falsos ou gráficos que aparentem negociação inexistente.

## Validação

- Confirmar mercado e 11 empresas no desktop e no telefone.
- Confirmar que todos os gráficos e painéis aparecem antes do primeiro negócio, marcados como referência quando aplicável.
- Abrir cada empresa e validar Comprar/Vender, Depositar/Levantar, KYC e mensagens de erro reais.
- Validar carteira vazia e com posições, livro vazio e com ordens, histórico e favoritos.
- Confirmar atualização empresarial horária, fonte e timestamp no ecrã.
- Executar testes do Exchange, verificação completa, build e testes visuais em 350x670 e 1230×1750, sem erros de consola nem sobreposição.
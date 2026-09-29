# Carrossel SQs na página inicial

## Objetivo
Substituir completamente a faixa que apresenta os métodos de pagamento por um carrossel visual dedicado a SQs Investimentos e SQs Apostas, mantendo intactos o cabeçalho, as cores e todas as restantes secções.

## Alterações
- Remover da página inicial a indicação “4 métodos de pagamento activos em MZN” e a faixa de pagamentos com os respetivos logótipos.
- Criar um componente de carrossel reutilizável com imagens já pertencentes à Betfcom SQs, associadas a Investimentos e Apostas.
- Alternar automaticamente a imagem ativa a cada 4 segundos.
- Aplicar transição suave de opacidade entre imagens.
- Incluir setas anterior/seguinte e indicadores clicáveis, com nomes acessíveis.
- Pausar a alternância durante interação por rato, toque ou foco e retomá-la automaticamente depois.
- Respeitar a preferência do dispositivo por movimento reduzido.
- Ajustar dimensões e conteúdos para telemóveis e computadores sem alterar o restante desenho da página.

## Verificação
- Confirmar que a faixa de pagamentos desapareceu por completo.
- Testar alternância automática, setas, indicadores, pausa e retoma.
- Rever visualmente em dimensões de telemóvel e computador.
- Confirmar que o site continua sem erros.

## Detalhes técnicos
- O estado e o temporizador ficam exclusivamente no componente visual do carrossel.
- As imagens serão importadas dos recursos locais existentes; não haverá imagens externas nem dados financeiros simulados.
- A página inicial apenas trocará a faixa antiga pelo novo componente.

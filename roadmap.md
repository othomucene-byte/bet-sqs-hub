# Roadmap

- [x] Desportos: sincronização em lotes pequenos (tempo + 10 pedidos/min do fornecedor); 2 dias de jogos (limite do plano gratuito)
- [x] Aviator/Fish: o multiplicador congela no instante exato do fim da ronda

## SQs Exchange
- [x] Base de dados, ledger de dupla entrada, motor de cruzamento e RLS
- [x] Adapters PAPER/BVM e provider de dados de mercado
- [x] Ecrãs de mercado, ativo, carteira, ordens, negócios, fundos, favoritos e histórico
- [x] Painel /admin/exchange e documentação em docs/architecture/sqs-exchange.md
- [ ] Negociação LIVE — bloqueada: exige operador de bolsa autorizado, credenciais e API oficial

- [x] SQs Exchange: mercado próprio real (SQSX-LIVE) + simulação, seletor de ambiente, KYC obrigatório para dinheiro real
- [x] SQs Exchange: candidaturas à listagem (utilizador) e aprovação/criação de instrumento (administração)
- [x] SQs Exchange: inteligência Mistral AI para dados das empresas com fonte, data, histórico e validação humana
- [x] Atualização automática dos dados das empresas de hora a hora (tarefa `exchange-ai-hourly` ativa, com fornecedor principal Mistral AI e alternativo Google AI)

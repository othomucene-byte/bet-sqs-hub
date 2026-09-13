# Betting & Invest Hub

BETFCOM SQs — Plataforma de Investimentos e Apostas

Crie uma plataforma web moderna, profissional, rápida e responsiva chamada BETFCOM SQs, com arquitetura preparada para operar dois produtos independentes dentro da mesma plataforma:

1. Estrutura principal

BETFCOM SQs

│

├── SQs Investimentos

│   ├── Carteira financeira

│   ├── Produtos de investimento

│   ├── Investimentos

│   ├── Rendimentos

│   └── Empresas

│

├── SQs Apostas

│   ├── Betting Wallet

│   ├── Eventos

│   ├── Odds

│   ├── Bilhetes

│   └── Liquidação

│

└── SQs Core Platform

    ├── Auth

    ├── Wallet

    ├── KYC

    ├── Payments

    ├── Ledger

    ├── Risk/Fraud

    └── Admin / Backoffice

2. Design

Criar uma interface premium de fintech + betting, com aparência confiável e profissional.

Prioridades:

Mobile-first

Responsivo em telemóvel, tablet e desktop

Navegação extremamente rápida

Dashboard moderno

Cards financeiros claros

Gráficos de desempenho

Sistema de notificações

Dark/Light mode

Português como idioma principal

Arquitetura preparada para Inglês e Francês

UI consistente em toda a plataforma

3. Página inicial

Criar uma landing page com:

Logo BETFCOM SQs

Hero principal

Explicação dos dois produtos

Botões Investir e Apostas

Benefícios

Como funciona

Segurança

Empresas

FAQ

Login

Criar conta

Não apresentar retornos garantidos nem promessas de lucro.

4. Autenticação

Implementar:

Criar conta

Login

Logout

Recuperação de palavra-passe

Verificação de email

Perfil do utilizador

KYC

Estado da conta: pending, verified, rejected, suspended

Preparar arquitetura para autenticação segura e controle de permissões.

5. SQs Investimentos

Criar dashboard com:

Saldo disponível

Valor investido

Rendimentos

Investimentos ativos

Histórico

Performance

Próximos pagamentos

Produtos disponíveis

Produtos

Cada produto deve apresentar:

Nome

Descrição

Valor mínimo

Prazo

Taxas

Risco

Condições

Estado

Documentação

Histórico

O sistema deve deixar explícito que rentabilidade depende das condições do produto e dos riscos envolvidos.

6. Empresas

Criar área para empresas:

Perfil da empresa

Verificação empresarial

Projetos

Necessidade de financiamento

Documentos

Investidores

Estado da candidatura

Dashboard financeiro

Fluxo:

Empresa → Candidatura → KYC/KYB → Análise → Aprovação → Publicação

A funcionalidade deve ser preparada para cumprir requisitos legais e regulatórios antes de aceitar investimentos reais.

7. SQs Apostas

Criar uma área completamente separada:

Eventos

Competições

Equipas

Jogos

Odds

Mercado

Bilhete de aposta

Apostas abertas

Apostas liquidadas

Histórico

Betting Wallet

Criar interface semelhante a uma sportsbook moderna.

A carteira de apostas deve ser separada contabilisticamente da carteira de investimentos.

8. Wallet

Criar sistema de carteira com:

Saldo disponível

Depósitos

Levantamentos

Transferências internas permitidas

Histórico

Estado das transações

ID único da transação

Nunca alterar o saldo diretamente.

Todas as movimentações devem gerar registros no Ledger.

9. Ledger

Criar um sistema de ledger imutável para registrar:

Depósitos

Levantamentos

Investimentos

Resgates

Rendimentos

Apostas

Prémios

Taxas

Ajustes administrativos

Cada transação deve possuir:

ID

User ID

Tipo

Valor

Moeda

Timestamp

Status

Referência

Saldo antes

Saldo depois

10. Payments

Preparar arquitetura para integração com provedores de pagamento.

Estados:

pending → processing → completed

ou

pending → failed

Nunca marcar pagamentos como concluídos apenas pelo frontend.

11. Risk & Fraud

Criar camada de Risk/Fraud para:

Limites de transação

Limites de apostas

Detecção de comportamento suspeito

Contas duplicadas

Transações anormais

Bloqueio temporário

Revisão manual

Audit log

12. Admin / Backoffice

Criar painel administrativo completo:

Dashboard

Utilizadores

Investidores

Empresas

Investimentos

Apostas

Volume financeiro

Depósitos

Levantamentos

Receita

Alertas

Risco

Gestão

Utilizadores

KYC

Empresas

Produtos

Investimentos

Eventos

Odds

Apostas

Pagamentos

Wallet

Ledger

Risk/Fraud

Notificações

Configurações

Criar RBAC com funções:

Super Admin

Finance Admin

KYC Admin

Risk Admin

Betting Admin

Support

13. Segurança

Implementar desde o início:

RLS

RBAC

Validação server-side

Rate limiting

Audit logs

Proteção contra manipulação de saldo

Proteção contra acesso indevido

Idempotência nas transações

Validação de pagamentos no backend

Separação entre dados financeiros e dados públicos

Nunca guardar palavras-passe em texto simples

Nunca expor secrets no frontend

14. Banco de dados

Criar uma estrutura organizada para:

users

profiles

kyc_verifications

businesses

investment_products

investments

investment_transactions

betting_events

betting_markets

betting_odds

betting_slips

betting_bets

wallets

wallet_transactions

ledger_entries

deposits

withdrawals

payment_providers

risk_events

fraud_alerts

notifications

audit_logs

admin_users

Criar foreign keys, índices, constraints e políticas RLS corretamente.

15. Regras importantes

Não criar funcionalidades financeiras falsas ou simuladas apresentadas como reais.

Se uma integração externa ainda não estiver configurada, criar uma interface de integração preparada, mas deixar o estado claramente como não configurado.

Não inventar pagamentos, odds, investimentos, saldos ou rendimentos.

O frontend nunca deve ser a autoridade para:

saldo

pagamento

investimento

aposta

liquidação

levantamento

Tudo deve ser validado no backend.

16. MVP

Priorizar primeiro:

Landing page

Cadastro/login

Dashboard

KYC

Wallet

Ledger

SQs Investimentos

SQs Apostas

Admin

Risk/Fraud

Payments preparados para integração

Construir uma base funcional, modular e escalável, evitando código desnecessário.

Objetivo final: entregar uma plataforma BETFCOM SQs com aparência de uma fintech profissional combinada com sportsbook, mas com arquitetura segura, modular e preparada para integrações reais e conformidade regulatória antes da operação com dinheiro real.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://bet-sqs-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f1a3e97d-cc85-4b38-8ab3-f45a6cd5b061).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

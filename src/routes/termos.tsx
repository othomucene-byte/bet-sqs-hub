import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Serviço — Betfcom SQs" },
      { name: "description", content: "Termos e condições de utilização da plataforma Betfcom SQs." },
      { property: "og:title", content: "Termos de Serviço — Betfcom SQs" },
      { property: "og:description", content: "Regras de utilização da Betfcom SQs." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://betfcom.com/termos" }],
  }),
  component: Page,
});

function Page() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-12 text-sm leading-relaxed">
      <h1 className="text-3xl font-semibold">Termos de Serviço</h1>
      <p className="text-muted-foreground">Betfcom SQs — Moçambique. Última atualização: setembro de 2026.</p>
      <h2 className="text-lg font-semibold">1. Elegibilidade</h2>
      <p>O serviço destina-se a maiores de 18 anos. A verificação de identidade pode ser exigida para depósitos, levantamentos e investimentos.</p>
      <h2 className="text-lg font-semibold">2. Conta</h2>
      <p>É responsável por manter as suas credenciais seguras. Cada pessoa pode ter apenas uma conta.</p>
      <h2 className="text-lg font-semibold">3. Risco</h2>
      <p>Apostas e investimentos envolvem risco de perda. A Betfcom SQs não garante retornos nem lucros. Jogue e invista com responsabilidade.</p>
      <h2 className="text-lg font-semibold">4. Pagamentos</h2>
      <p>Saldos, depósitos e levantamentos são sempre confirmados pelo servidor e pelos processadores de pagamento. Movimentos suspeitos podem ser retidos para verificação.</p>
      <h2 className="text-lg font-semibold">5. Alterações</h2>
      <p>Podemos atualizar estes termos; a versão em vigor está sempre publicada nesta página.</p>
      <p><Link to="/" className="underline">Voltar à página inicial</Link></p>
    </main>
  );
}

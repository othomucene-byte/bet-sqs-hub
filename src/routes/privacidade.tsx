import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Betfcom SQs" },
      { name: "description", content: "Como a Betfcom SQs recolhe, usa e protege os seus dados pessoais." },
      { property: "og:title", content: "Política de Privacidade — Betfcom SQs" },
      { property: "og:description", content: "Como a Betfcom SQs trata os seus dados pessoais." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://betfcom.com/privacidade" }],
  }),
  component: Page,
});

function Page() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-12 text-sm leading-relaxed">
      <h1 className="text-3xl font-semibold">Política de Privacidade</h1>
      <p className="text-muted-foreground">Betfcom SQs — Moçambique. Última atualização: setembro de 2026.</p>
      <h2 className="text-lg font-semibold">1. Dados que recolhemos</h2>
      <p>Nome, email, número de telefone, dados de identificação (KYC) e registos de transações necessários para operar a conta, a carteira, as apostas e os investimentos. Ao entrar com Google recebemos apenas o seu nome, email e foto de perfil.</p>
      <h2 className="text-lg font-semibold">2. Como usamos os dados</h2>
      <p>Para criar e proteger a sua conta, processar depósitos e levantamentos, cumprir obrigações legais (prevenção de fraude e branqueamento de capitais) e comunicar consigo sobre a conta.</p>
      <h2 className="text-lg font-semibold">3. Partilha</h2>
      <p>Não vendemos dados pessoais. Partilhamos apenas o necessário com processadores de pagamento e prestadores técnicos, ou quando exigido por lei.</p>
      <h2 className="text-lg font-semibold">4. Segurança e retenção</h2>
      <p>Os dados são guardados em servidores protegidos, com acesso restrito. Mantemos os registos financeiros pelo prazo legal exigido.</p>
      <h2 className="text-lg font-semibold">5. Os seus direitos</h2>
      <p>Pode pedir acesso, correção ou eliminação dos seus dados, contactando-nos através do email da sua conta.</p>
      <p><Link to="/" className="underline">Voltar à página inicial</Link></p>
    </main>
  );
}

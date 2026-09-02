import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  FileCheck2,
  LineChart,
  Lock,
  ScrollText,
  ShieldCheck,
  Ticket,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import heroImage from "@/assets/hero.jpg";

const title = "BETFCOM SQs — Investimentos e Apostas numa só plataforma";
const description =
  "Plataforma modular BETFCOM SQs: SQs Investimentos e SQs Apostas, com wallet, ledger imutável, KYC e backoffice preparados para conformidade regulatória.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const produtos = [
  {
    icon: TrendingUp,
    tag: "SQs Investimentos",
    title: "Investir em produtos estruturados",
    text: "Carteira financeira, produtos com prazo, taxas e risco explícitos, acompanhamento de rendimentos e histórico completo.",
    items: ["Carteira financeira", "Produtos de investimento", "Rendimentos", "Empresas"],
  },
  {
    icon: Ticket,
    tag: "SQs Apostas",
    title: "Sportsbook moderno e separado",
    text: "Área independente com eventos, mercados, odds, bilhetes e liquidação. Betting Wallet separada contabilisticamente.",
    items: ["Betting Wallet", "Eventos e mercados", "Bilhetes", "Liquidação"],
  },
];

const beneficios = [
  {
    icon: Wallet,
    title: "Duas carteiras, um só perfil",
    text: "Investimentos e apostas com saldos e contabilidade separados, sob a mesma identidade verificada.",
  },
  {
    icon: ScrollText,
    title: "Ledger imutável",
    text: "Cada movimento gera um registo com ID, tipo, valor, saldo antes e depois — sem alteração direta de saldo.",
  },
  {
    icon: ShieldCheck,
    title: "Risk & Fraud",
    text: "Limites de transação e de aposta, deteção de comportamento suspeito e revisão manual com audit log.",
  },
  {
    icon: LineChart,
    title: "Dashboards claros",
    text: "Cards financeiros, desempenho, próximos pagamentos e notificações em tempo útil.",
  },
];

const passos = [
  { n: "01", title: "Criar conta", text: "Registo com email verificado e perfil de utilizador." },
  { n: "02", title: "KYC", text: "Estado da conta: pending, verified, rejected ou suspended." },
  { n: "03", title: "Wallet", text: "Depósitos e levantamentos validados no backend, nunca no frontend." },
  { n: "04", title: "Operar", text: "Investir em produtos ou apostar em eventos, com registo no ledger." },
];

const seguranca = [
  "RLS e RBAC em toda a base de dados",
  "Validação server-side e idempotência nas transações",
  "Rate limiting e audit logs",
  "Separação entre dados financeiros e dados públicos",
  "Pagamentos confirmados apenas pelo backend",
  "Secrets nunca expostos no frontend",
];

const faq = [
  {
    q: "A BETFCOM SQs garante rentabilidade?",
    a: "Não. A rentabilidade depende sempre das condições de cada produto e dos riscos envolvidos. Não apresentamos retornos garantidos nem promessas de lucro.",
  },
  {
    q: "As carteiras de investimento e de apostas são a mesma?",
    a: "Não. A Betting Wallet é separada contabilisticamente da carteira de investimentos, ainda que ambas pertençam ao mesmo perfil verificado.",
  },
  {
    q: "Já é possível depositar dinheiro real?",
    a: "Não. Os provedores de pagamento estão preparados para integração, mas o estado atual é não configurado. Nenhum saldo, odd ou rendimento é simulado como real.",
  },
  {
    q: "Como funciona a candidatura de empresas?",
    a: "Empresa → candidatura → KYC/KYB → análise → aprovação → publicação. Só após conformidade legal os projetos podem receber investimento.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="bg-hero-gradient absolute inset-0" aria-hidden="true" />
          <img
            src={heroImage}
            alt="Visualização de desempenho financeiro sob luzes de estádio"
            width={1600}
            height={1008}
            className="absolute inset-0 size-full object-cover opacity-25 mix-blend-screen"
          />
          <div className="relative mx-auto w-full max-w-6xl px-4 py-20 sm:py-28">
            <Badge variant="secondary" className="mb-5">
              {paymentsBadge}
            </Badge>
            <h1 className="max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight text-hero-foreground sm:text-6xl">
              Investir e apostar, com a mesma exigência de confiança.
            </h1>
            <p className="mt-5 max-w-xl text-base text-hero-muted sm:text-lg">
              Duas áreas independentes — SQs Investimentos e SQs Apostas — sob uma única identidade
              verificada, com carteiras separadas e histórico completo de cada movimento.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <a href="/investimentos">
                  Ver produtos de investimento <ArrowRight className="ml-1.5 size-4" />
                </a>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <a href="/auth">Criar conta</a>
              </Button>
            </div>

            <dl className="mt-14 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ["Moeda", "Metical (MZN)"],
                ["Carteiras", "Investimentos · Apostas"],
                ["Depósitos", "Móveis e cartão"],
                ["Histórico", "Extrato completo"],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="min-w-0 rounded-xl border border-hero-foreground/15 bg-hero-foreground/5 p-3"
                >
                  <dt className="text-xs text-hero-muted">{k}</dt>
                  <dd className="mt-1 font-display text-sm font-semibold text-hero-foreground sm:text-base">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Métodos de pagamento */}
        <section className="border-b border-border/60 bg-card/40">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-4 py-8 sm:flex-row sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Depósitos e levantamentos em meticais, confirmados no servidor.
            </p>
            <ul className="flex flex-wrap items-center justify-center gap-6">
              {payLogos.map((logo) => (
                <li key={logo.alt}>
                  <img
                    src={logo.src}
                    alt={logo.alt}
                    loading="lazy"
                    className="h-7 w-auto object-contain opacity-80"
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>



        {/* Produtos */}
        <section id="produtos" className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-24">
          <h2 className="text-2xl font-bold sm:text-4xl">Dois produtos, uma plataforma</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Cada produto tem a sua própria carteira, o seu próprio fluxo e as suas próprias regras
            de risco.
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {produtos.map((p) => (
              <article key={p.tag} className="card-elevated p-6">
                <div className="flex items-center gap-3">
                  <span className="bg-brand-gradient flex size-10 items-center justify-center rounded-xl text-primary-foreground">
                    <p.icon className="size-5" />
                  </span>
                  <Badge variant="outline">{p.tag}</Badge>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.text}</p>
                <ul className="mt-4 grid gap-2 text-sm">
                  {p.items.map((i) => (
                    <li key={i} className="flex items-center gap-2">
                      <BadgeCheck className="size-4 text-primary" /> {i}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* Benefícios */}
        <section className="border-y border-border/60 bg-card/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-24">
            <h2 className="text-2xl font-bold sm:text-4xl">Benefícios</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {beneficios.map((b) => (
                <article key={b.title} className="card-elevated p-5">
                  <b.icon className="size-5 text-primary" />
                  <h3 className="mt-3 text-base font-semibold">{b.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{b.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Como funciona */}
        <section id="como-funciona" className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-24">
          <h2 className="text-2xl font-bold sm:text-4xl">Como funciona</h2>
          <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {passos.map((s) => (
              <li key={s.n} className="card-elevated p-5">
                <span className="font-display text-sm font-bold text-primary">{s.n}</span>
                <h3 className="mt-2 text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Segurança */}
        <section id="seguranca" className="border-y border-border/60 bg-card/40">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 sm:py-24 lg:grid-cols-2">
            <div>
              <Lock className="size-6 text-primary" />
              <h2 className="mt-4 text-2xl font-bold sm:text-4xl">Segurança desde o início</h2>
              <p className="mt-3 text-muted-foreground">
                O frontend nunca é a autoridade sobre saldo, pagamento, investimento, aposta,
                liquidação ou levantamento. Tudo é validado no backend.
              </p>
            </div>
            <ul className="grid gap-3">
              {seguranca.map((s) => (
                <li key={s} className="card-elevated flex items-start gap-3 p-4 text-sm">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Empresas */}
        <section id="empresas" className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-24">
          <div className="card-elevated grid gap-8 p-6 sm:p-10 lg:grid-cols-2">
            <div>
              <Building2 className="size-6 text-primary" />
              <h2 className="mt-4 text-2xl font-bold sm:text-3xl">Área para empresas</h2>
              <p className="mt-3 text-muted-foreground">
                Perfil empresarial, verificação KYB, projetos, necessidade de financiamento,
                documentos e dashboard financeiro — com estado da candidatura sempre visível.
              </p>
              <Button className="mt-6" variant="outline" asChild>
                <a href="/empresas#candidatura">
                  Submeter candidatura <ArrowRight className="ml-1.5 size-4" />
                </a>
              </Button>
            </div>
            <ol className="grid gap-3">
              {[
                "Candidatura da empresa",
                "KYC / KYB",
                "Análise interna",
                "Aprovação",
                "Publicação do projeto",
              ].map((step, i) => (
                <li key={step} className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-3 text-sm">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-gradient font-display text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-border/60 bg-card/40">
          <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:py-24">
            <h2 className="text-2xl font-bold sm:text-4xl">Perguntas frequentes</h2>
            <Accordion type="single" collapsible className="mt-6">
              {faq.map((f) => (
                <AccordionItem key={f.q} value={f.q}>
                  <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Conta */}
        <section id="conta" className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-24">
          <div className="card-elevated flex flex-col items-start gap-6 p-6 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <FileCheck2 className="size-6 text-primary" />
              <h2 className="mt-4 text-2xl font-bold sm:text-3xl">Contas e KYC</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Registo com email verificado, login com palavra-passe ou Google, e carteiras
                separadas para investimentos e apostas — tudo validado no servidor.
              </p>
            </div>
            <div className="flex w-full gap-3 lg:w-auto">
              <Button className="flex-1 lg:flex-none" asChild>
                <a href="/auth">Criar conta</a>
              </Button>
              <Button variant="outline" className="flex-1 lg:flex-none" asChild>
                <a href="/auth">Entrar</a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

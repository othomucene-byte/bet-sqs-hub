import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CreditCard,
  Landmark,
  Lock,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  NETSHOP_API_BASE,
  NETSHOP_METHODS,
  NETSHOP_REQUIRED_SECRETS,
  NETSHOP_STATUS,
  NETSHOP_STATUS_LABEL,
  isNetshopConfigured,
  type NetshopMethod,
  type PaymentDirection,
} from "@/lib/payments/netshop";
import logoCard from "@/assets/logo-card.png.asset.json";
import logoMpesa from "@/assets/logo-mpesa.png.asset.json";
import logoEmola from "@/assets/logo-emola.png.asset.json";
import logoMkesh from "@/assets/logo-mkesh.png.asset.json";

const TITLE = "Pagamentos Netshop — BETFCOM SQs";
const DESCRIPTION =
  "Integração de pagamentos Netshop para Moçambique: M-Pesa, e-Mola, mKesh, cartão e transferência bancária, com validação no servidor e ledger imutável.";

export const Route = createFileRoute("/pagamentos")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PagamentosPage,
});

const kindIcon = {
  mobile_money: Smartphone,
  card: CreditCard,
  bank_transfer: Landmark,
} as const;

/** Logos oficiais dos métodos (recortes das marcas enviadas pelo utilizador). */
const methodLogo: Partial<Record<NetshopMethod["id"], string>> = {
  mpesa: logoMpesa.url,
  emola: logoEmola.url,
  mkesh: logoMkesh.url,
  card: logoCard.url,
};

function MethodCard({ method }: { method: NetshopMethod }) {
  const Icon = kindIcon[method.kind];
  const logo = methodLogo[method.id];
  return (
    <Card className="card-elevated">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          {logo ? (
            <img
              src={logo}
              alt={`Logótipo ${method.name}`}
              width={40}
              height={40}
              className="size-10 rounded-xl object-contain"
            />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-xl bg-secondary">
              <Icon className="size-5 text-primary" />
            </div>
          )}
          <Badge variant="outline">{NETSHOP_STATUS_LABEL[NETSHOP_STATUS]}</Badge>
        </div>
        <CardTitle className="text-base">{method.name}</CardTitle>
        <CardDescription>
          {method.provider} · {method.currency}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>{method.notes}</p>
        <div className="flex flex-wrap gap-1.5">
          {method.directions.includes("deposit") && <Badge variant="secondary">Depósito</Badge>}
          {method.directions.includes("withdrawal") && (
            <Badge variant="secondary">Levantamento</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionForm({ direction }: { direction: PaymentDirection }) {
  const isDeposit = direction === "deposit";
  const methods = NETSHOP_METHODS.filter((m) => m.directions.includes(direction));

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-lg">
            {isDeposit ? "Novo depósito" : "Novo levantamento"}
          </CardTitle>
          <CardDescription>
            {isDeposit
              ? "O valor só entra na carteira depois de o gateway confirmar o pagamento por webhook."
              : "Levantamentos exigem KYC aprovado e são libertados após validação de risco no servidor."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor={`${direction}-wallet`}>Carteira</Label>
            <select
              id={`${direction}-wallet`}
              disabled
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option>Carteira de Investimentos</option>
              <option>Betting Wallet</option>
            </select>
            <p className="text-xs text-muted-foreground">
              As duas carteiras são contabilisticamente separadas — sem transferências implícitas.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${direction}-method`}>Método Netshop</Label>
            <select
              id={`${direction}-method`}
              disabled
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {methods.map((m) => (
                <option key={m.id}>
                  {m.name} — {m.provider}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`${direction}-amount`}>Valor (MZN)</Label>
              <Input id={`${direction}-amount`} placeholder="0,00" disabled />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${direction}-identifier`}>Identificador</Label>
              <Input id={`${direction}-identifier`} placeholder="84xxxxxxx" disabled />
            </div>
          </div>

          <Button className="w-full" disabled>
            <Lock className="mr-2 size-4" />
            {isDeposit ? "Depositar" : "Solicitar levantamento"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Formulário inativo: a integração Netshop está{" "}
            <span className="font-medium text-foreground">não configurada</span> e nenhum movimento
            pode ser criado sem backend.
          </p>
        </CardContent>
      </Card>

      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-lg">Fluxo validado no servidor</CardTitle>
          <CardDescription>Ordem obrigatória de eventos para cada movimento.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4 text-sm">
            {(isDeposit
              ? [
                  "Pedido de depósito criado no backend com valor, carteira e método.",
                  "Movimento registado no ledger imutável como pending, sem alterar saldo.",
                  "Netshop inicia a cobrança (USSD push ou checkout alojado).",
                  "Webhook assinado confirma o pagamento; a assinatura HMAC é verificada.",
                  "Ledger recebe a entrada settled e o saldo é recalculado no servidor.",
                ]
              : [
                  "Pedido de levantamento criado no backend após verificação de KYC.",
                  "Risk/Fraud avalia limites, histórico e destino antes de aprovar.",
                  "Fundos reservados no ledger (hold) — saldo disponível reduzido.",
                  "Netshop executa o payout para a carteira móvel ou conta bancária.",
                  "Webhook confirma a execução e o hold converte-se em débito final.",
                ]
            ).map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function PagamentosPage() {
  const configured = isNetshopConfigured();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-12">
        <header className="max-w-3xl space-y-4">
          <Badge variant="outline" className="gap-1.5">
            <AlertTriangle className="size-3.5" />
            Netshop: {NETSHOP_STATUS_LABEL[NETSHOP_STATUS]}
          </Badge>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Gateway de pagamentos Netshop
          </h1>
          <p className="text-muted-foreground">
            Arquitetura de depósitos e levantamentos em meticais para todos os métodos usados em
            Moçambique. A interface está pronta, mas nenhuma transação pode ser criada enquanto o
            backend e as credenciais não estiverem ativos.
          </p>
        </header>

        {!configured && (
          <Card className="mt-8 border-destructive/40 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="size-4 text-destructive" />
                Integração não configurada
              </CardTitle>
              <CardDescription>
                Sem backend ativo não existem saldos, referências nem confirmações reais. Nada nesta
                página representa dinheiro movimentado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-medium">Falta ativar, por esta ordem:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>Backend da plataforma (base de dados, auth, ledger e server functions).</li>
                  <li>
                    Secrets do gateway:{" "}
                    <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">
                      {NETSHOP_REQUIRED_SECRETS.join(", ")}
                    </code>
                  </li>
                  <li>
                    Endpoint de webhook assinado registado no painel Netshop:{" "}
                    <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">
                      /api/public/webhooks/netshop
                    </code>
                  </li>
                </ul>
              </div>
              <Separator />
              <p className="text-muted-foreground">
                API base prevista:{" "}
                <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">
                  {NETSHOP_API_BASE}
                </code>
              </p>
            </CardContent>
          </Card>
        )}

        <section className="mt-12">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Métodos de pagamento
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Catálogo previsto para Moçambique, em meticais (MZN).
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {NETSHOP_METHODS.map((m) => (
              <MethodCard key={m.id} method={m} />
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Depósitos e levantamentos
          </h2>
          <Tabs defaultValue="deposit" className="mt-6">
            <TabsList>
              <TabsTrigger value="deposit" className="gap-1.5">
                <ArrowDownToLine className="size-4" />
                Depósito
              </TabsTrigger>
              <TabsTrigger value="withdrawal" className="gap-1.5">
                <ArrowUpFromLine className="size-4" />
                Levantamento
              </TabsTrigger>
            </TabsList>
            <TabsContent value="deposit" className="mt-6">
              <TransactionForm direction="deposit" />
            </TabsContent>
            <TabsContent value="withdrawal" className="mt-6">
              <TransactionForm direction="withdrawal" />
            </TabsContent>
          </Tabs>
        </section>

        <section className="mt-12">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Regras de segurança da integração
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              {
                title: "Credenciais só no servidor",
                text: "API key e merchant ID nunca chegam ao browser; as chamadas partem de server functions.",
              },
              {
                title: "Webhook com assinatura verificada",
                text: "Confirmações são aceites apenas com HMAC válido e comparação em tempo constante.",
              },
              {
                title: "Idempotência por referência",
                text: "Cada movimento tem referência única; webhooks repetidos não duplicam saldo.",
              },
              {
                title: "Ledger imutável",
                text: "Nenhuma linha é editada nem apagada — correções entram como novos movimentos.",
              },
            ].map((item) => (
              <Card key={item.title} className="card-elevated">
                <CardHeader className="space-y-2">
                  <ShieldCheck className="size-5 text-primary" />
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <CardDescription>{item.text}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

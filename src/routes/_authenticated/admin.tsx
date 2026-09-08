import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { syncSportsNow } from "@/lib/sports/sports.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  amIAdmin,
  decideKyc,
  getAdminOverview,
  listAllInvestments,
  listAllOrders,
  listApplications,
  listKycQueue,
  listPayments,
  listRiskSignals,
  postReturn,
  reviewApplication,
} from "@/lib/admin/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Backoffice — Betfcom SQs" },
      {
        name: "description",
        content:
          "Backoffice com controlo de acesso por papel: revisão de KYC, ordens, investimentos, resultados declarados, pagamentos, risco e candidaturas de empresas.",
      },
      { property: "og:title", content: "Backoffice Betfcom SQs" },
      {
        property: "og:description",
        content: "Todas as leituras e acções verificam o papel de administrador no servidor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

const MZN = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "MZN" });

function AdminPage() {
  const queryClient = useQueryClient();
  const checkAdmin = useServerFn(amIAdmin);
  const role = useQuery({ queryKey: ["am-i-admin"], queryFn: () => checkAdmin() });

  if (role.isLoading) {
    return (
      <div className="min-h-dvh bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-4 py-24 text-center text-muted-foreground">
          A validar permissões…
        </main>
      </div>
    );
  }

  if (!role.data?.admin) {
    return (
      <div className="min-h-dvh bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-4 py-24 text-center">
          <h1 className="font-heading text-2xl font-bold">Acesso restrito</h1>
          <p className="mt-2 text-muted-foreground">
            Esta área é exclusiva de administradores. O servidor recusa qualquer leitura sem esse
            papel.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 pb-20">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">Backoffice</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada leitura e cada acção confirmam o papel de administrador no servidor.
        </p>

        <AdminOverviewCards />

        <Tabs defaultValue="kyc" className="mt-6">
          <TabsList className="flex w-full flex-wrap justify-start">
            <TabsTrigger value="kyc">KYC</TabsTrigger>
            <TabsTrigger value="ordens">Ordens</TabsTrigger>
            <TabsTrigger value="investimentos">Investimentos</TabsTrigger>
            <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
            <TabsTrigger value="risco">Risco</TabsTrigger>
            <TabsTrigger value="empresas">Candidaturas</TabsTrigger>
            <TabsTrigger value="desportos">Desportos</TabsTrigger>
          </TabsList>

          <TabsContent value="kyc" className="mt-4">
            <KycQueue onDecided={() => queryClient.invalidateQueries({ queryKey: ["admin-overview"] })} />
          </TabsContent>
          <TabsContent value="ordens" className="mt-4">
            <OrdersTable />
          </TabsContent>
          <TabsContent value="investimentos" className="mt-4">
            <InvestmentsTable />
          </TabsContent>
          <TabsContent value="pagamentos" className="mt-4">
            <PaymentsTable />
          </TabsContent>
          <TabsContent value="risco" className="mt-4">
            <RiskTable />
          </TabsContent>
          <TabsContent value="empresas" className="mt-4">
            <ApplicationsTable />
          </TabsContent>
          <TabsContent value="desportos" className="mt-4">
            <SportsSyncCard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function SportsSyncCard() {
  const runSync = useServerFn(syncSportsNow);
  const mutation = useMutation({
    mutationFn: () => runSync(),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error("Sincronização não realizada", { description: result.error });
        return;
      }
      toast.success("Desportos sincronizados", {
        description: `${result.catalog.events} jogos, ${result.catalog.odds} cotações, ${result.results.settled} jogos liquidados`,
      });
    },
    onError: (error: Error) => toast.error("Sincronização falhou", { description: error.message }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Desportos</CardTitle>
        <CardDescription>
          Atualiza jogos e cotações do fornecedor e liquida os bilhetes com resultados finais. A
          sincronização também corre automaticamente pelo agendador.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? "A sincronizar…" : "Sincronizar agora"}
        </Button>
        {mutation.data && mutation.data.ok && mutation.data.catalog.errors.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {mutation.data.catalog.errors.slice(0, 6).map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AdminOverviewCards() {
  const fetchOverview = useServerFn(getAdminOverview);
  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: () => fetchOverview() });
  const data = overview.data;

  const cards = [
    { label: "Clientes", value: data ? String(data.users) : "—" },
    { label: "KYC pendentes", value: data ? String(data.kycPending) : "—" },
    { label: "Capital investido", value: data ? MZN.format(data.investedTotal) : "—" },
    { label: "Ordens em curso", value: data ? String(data.ordersPending) : "—" },
    { label: "Saldo em carteiras", value: data ? MZN.format(data.walletsBalance) : "—" },
    { label: "Depósitos concluídos", value: data ? String(data.depositsCompleted) : "—" },
    { label: "Levantamentos pendentes", value: data ? String(data.withdrawalsPending) : "—" },
    { label: "Apostas (24h)", value: data ? String(data.betsToday) : "—" },
  ];

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">{card.label}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-lg font-bold tabular-nums">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function KycQueue({ onDecided }: { onDecided: () => void }) {
  const queryClient = useQueryClient();
  const fetchQueue = useServerFn(listKycQueue);
  const doDecide = useServerFn(decideKyc);
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const queue = useQuery({
    queryKey: ["admin-kyc", status],
    queryFn: () => fetchQueue({ data: { status } }),
  });

  const decide = useMutation({
    mutationFn: async (input: { kycId: string; decision: "approved" | "rejected" }) =>
      doDecide({
        data: {
          kycId: input.kycId,
          decision: input.decision,
          notes: notes[input.kycId] || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Decisão registada e cliente notificado.");
      queryClient.invalidateQueries({ queryKey: ["admin-kyc"] });
      onDecided();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível decidir."),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">Fila de KYC</CardTitle>
          <CardDescription>Aprovação sempre manual — nada é automático.</CardDescription>
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="rejected">Recusados</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="grid gap-3">
        {(queue.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {queue.isLoading ? "A carregar…" : "Nada nesta fila."}
          </p>
        ) : (
          (queue.data ?? []).map((row) => (
            <div key={row.id} className="grid gap-2 rounded-lg border border-border/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{row.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.documentType.toUpperCase()} {row.documentNumber} · {row.province ?? "—"} ·
                    perfil {row.riskProfile}
                  </p>
                </div>
                <Badge variant="outline">{row.status}</Badge>
              </div>
              {row.status === "pending" ? (
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <Input
                    placeholder="Notas de revisão (obrigatórias em caso de recusa)"
                    value={notes[row.id] ?? ""}
                    onChange={(e) => setNotes({ ...notes, [row.id]: e.target.value })}
                  />
                  <Button
                    size="sm"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ kycId: row.id, decision: "approved" })}
                  >
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={decide.isPending || !(notes[row.id] ?? "").trim()}
                    onClick={() => decide.mutate({ kycId: row.id, decision: "rejected" })}
                  >
                    Recusar
                  </Button>
                </div>
              ) : row.reviewNotes ? (
                <p className="text-xs text-muted-foreground">Notas: {row.reviewNotes}</p>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function OrdersTable() {
  const fetchOrders = useServerFn(listAllOrders);
  const orders = useQuery({ queryKey: ["admin-orders"], queryFn: () => fetchOrders() });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ordens de todos os clientes</CardTitle>
        <CardDescription>Estado atribuído pelas funções atómicas do servidor.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Montante</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(orders.data ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap text-xs">
                  {new Date(row.createdAt).toLocaleString("pt-PT")}
                </TableCell>
                <TableCell className="font-mono text-xs">{row.userId.slice(0, 8)}</TableCell>
                <TableCell>{row.side === "buy" ? "Subscrição" : "Resgate"}</TableCell>
                <TableCell>{row.productName ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{MZN.format(row.amount)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{row.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function InvestmentsTable() {
  const queryClient = useQueryClient();
  const fetchInvestments = useServerFn(listAllInvestments);
  const doPost = useServerFn(postReturn);
  const investments = useQuery({
    queryKey: ["admin-investments"],
    queryFn: () => fetchInvestments(),
  });

  const [target, setTarget] = useState("");
  const [kind, setKind] = useState<"PROFIT" | "LOSS">("PROFIT");
  const [amount, setAmount] = useState("");
  const [settle, setSettle] = useState("false");

  const post = useMutation({
    mutationFn: async () =>
      doPost({
        data: {
          investmentId: target,
          kind,
          amount: Number(amount),
          reference: `ret:${crypto.randomUUID()}`,
          settle: settle === "true",
        },
      }),
    onSuccess: () => {
      toast.success("Resultado declarado registado.");
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["admin-investments"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível registar."),
  });

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lançar resultado declarado</CardTitle>
          <CardDescription>
            &quot;Liquidar agora&quot; move o valor na carteira; caso contrário fica acumulado até ao
            resgate.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="grid gap-1.5 lg:col-span-2">
            <Label>Investimento</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger>
                <SelectValue placeholder="Escolher" />
              </SelectTrigger>
              <SelectContent>
                {(investments.data ?? [])
                  .filter((i) => i.status === "active")
                  .map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.reference} · {i.productName ?? "—"} · {MZN.format(i.amount)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as "PROFIT" | "LOSS")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PROFIT">Rendimento</SelectItem>
                <SelectItem value="LOSS">Prejuízo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ret-amount">Montante</Label>
            <Input
              id="ret-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Liquidar agora</Label>
            <Select value={settle} onValueChange={setSettle}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">Não</SelectItem>
                <SelectItem value="true">Sim</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="lg:col-span-5"
            disabled={!target || !amount || Number(amount) <= 0 || post.isPending}
            onClick={() => post.mutate()}
          >
            Registar resultado
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Investimentos</CardTitle>
          <CardDescription>Todos os clientes, 200 mais recentes.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referência</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Capital</TableHead>
                <TableHead className="text-right">Resultado</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Maturidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(investments.data ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.reference}</TableCell>
                  <TableCell>{row.productName ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{MZN.format(row.amount)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {MZN.format(row.accruedReturn)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {new Date(row.maturesAt).toLocaleDateString("pt-PT")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentsTable() {
  const fetchPayments = useServerFn(listPayments);
  const payments = useQuery({ queryKey: ["admin-payments"], queryFn: () => fetchPayments() });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Depósitos e levantamentos</CardTitle>
        <CardDescription>
          Reconciliação com o gateway: cada intenção tem referência única e idempotência.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Direcção</TableHead>
              <TableHead>Método</TableHead>
              <TableHead className="text-right">Montante</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Ref. gateway</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(payments.data ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap text-xs">
                  {new Date(row.createdAt).toLocaleString("pt-PT")}
                </TableCell>
                <TableCell>{row.direction === "deposit" ? "Depósito" : "Levantamento"}</TableCell>
                <TableCell>{row.method}</TableCell>
                <TableCell className="text-right tabular-nums">{MZN.format(row.amount)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{row.status}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {row.providerTransactionId ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RiskTable() {
  const fetchRisk = useServerFn(listRiskSignals);
  const risk = useQuery({ queryKey: ["admin-risk"], queryFn: () => fetchRisk() });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sinais de risco (48h)</CardTitle>
        <CardDescription>Movimentos de valor absoluto igual ou superior a 25 000 MZN.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {(risk.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {risk.isLoading ? "A carregar…" : "Sem sinais no período."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Montante</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Referência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(risk.data ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(row.createdAt).toLocaleString("pt-PT")}
                  </TableCell>
                  <TableCell>{row.type}</TableCell>
                  <TableCell className="text-right tabular-nums">{MZN.format(row.amount)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {MZN.format(row.balanceAfter)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.reference}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ApplicationsTable() {
  const fetchApplications = useServerFn(listApplications);
  const review = useServerFn(reviewApplication);
  const queryClient = useQueryClient();
  const applications = useQuery({
    queryKey: ["admin-applications"],
    queryFn: () => fetchApplications(),
  });

  const decide = useMutation({
    mutationFn: (input: { applicationId: string; decision: "approved" | "rejected" }) =>
      review({ data: input }),
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
      toast.success(
        vars.decision === "approved"
          ? "Candidatura aprovada. A empresa já aparece na página pública."
          : "Candidatura recusada.",
      );
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível decidir."),
  });


  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Candidaturas de empresas</CardTitle>
        <CardDescription>Submetidas na página pública de empresas.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {(applications.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {applications.isLoading ? "A carregar…" : "Sem candidaturas."}
          </p>
        ) : (
          (applications.data ?? []).map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 p-3"
            >
              <div>
                <p className="text-sm font-semibold">{row.companyName}</p>
                <p className="text-xs text-muted-foreground">
                  {row.sector} · {row.contactName} · {row.contactEmail}
                  {row.contactPhone ? ` · ${row.contactPhone}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {row.fundingGoal ? (
                  <span className="text-sm tabular-nums">{MZN.format(row.fundingGoal)}</span>
                ) : null}
                <Badge variant="outline">{row.status}</Badge>
                {row.status === "submitted" || row.status === "pending" ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={decide.isPending}
                      onClick={() =>
                        decide.mutate({ applicationId: row.id, decision: "approved" })
                      }
                    >
                      Aprovar e publicar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={decide.isPending}
                      onClick={() =>
                        decide.mutate({ applicationId: row.id, decision: "rejected" })
                      }
                    >
                      Recusar
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

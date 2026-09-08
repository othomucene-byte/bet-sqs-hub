import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BellRing } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { InvestorNav } from "@/components/investor-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listNotifications, markNotificationsRead } from "@/lib/investments/portfolio.functions";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — Betfcom SQs" },
      {
        name: "description",
        content:
          "Avisos sobre investimentos, pagamentos e verificação de identidade, gerados no servidor a cada operação registada.",
      },
      { property: "og:title", content: "Notificações — Betfcom SQs" },
      {
        property: "og:description",
        content: "Cada operação relevante gera um aviso associado à tua conta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotificationsPage,
});

const categoryLabel: Record<string, string> = {
  general: "Geral",
  investment: "Investimentos",
  payment: "Pagamentos",
  kyc: "KYC",
  betting: "Apostas",
  risk: "Risco",
};

function NotificationsPage() {
  const queryClient = useQueryClient();
  const fetchNotifications = useServerFn(listNotifications);
  const doMarkRead = useServerFn(markNotificationsRead);

  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(),
  });

  const markRead = useMutation({
    mutationFn: async () => doMarkRead({ data: {} }),
    onSuccess: () => {
      toast.success("Notificações marcadas como lidas.");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["investor-overview"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível actualizar."),
  });

  const rows = notifications.data ?? [];
  const unread = rows.filter((row) => !row.readAt).length;

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 pb-20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold sm:text-3xl">Notificações</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {unread > 0 ? `${unread} não lidas` : "Tudo lido"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={unread === 0 || markRead.isPending}
            onClick={() => markRead.mutate()}
          >
            Marcar todas como lidas
          </Button>
        </div>

        <InvestorNav className="mt-5" />

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Últimos avisos</CardTitle>
            <CardDescription>Gerados pelo servidor a cada operação registada.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {notifications.isLoading ? "A carregar…" : "Sem notificações."}
              </p>
            ) : (
              rows.map((row) => (
                <div
                  key={row.id}
                  className={
                    row.readAt
                      ? "rounded-lg border border-border/60 p-3"
                      : "rounded-lg border border-primary/40 bg-primary/5 p-3"
                  }
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      {row.readAt ? null : <BellRing className="size-3.5 text-primary" />}
                      {row.title}
                    </p>
                    <Badge variant="outline">{categoryLabel[row.category] ?? row.category}</Badge>
                  </div>
                  {row.body ? (
                    <p className="mt-1 text-sm text-muted-foreground">{row.body}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString("pt-PT")}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

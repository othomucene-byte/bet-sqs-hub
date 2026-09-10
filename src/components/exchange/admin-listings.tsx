import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  decideListingApplication,
  listListingApplications,
} from "@/lib/exchange/listing.functions";

const STATUS_LABEL: Record<string, string> = {
  submitted: "Submetida",
  under_review: "Em análise",
  approved: "Aprovada",
  rejected: "Recusada",
};

/** Revisão administrativa das candidaturas à listagem no mercado real. */
export function AdminListings() {
  const queryClient = useQueryClient();
  const fetchList = useServerFn(listListingApplications);
  const decide = useServerFn(decideListingApplication);
  const [tick, setTick] = useState("0.01");
  const [lot, setLot] = useState("1");
  const [note, setNote] = useState("");

  const query = useQuery({ queryKey: ["admin-listings"], queryFn: () => fetchList() });

  const mutation = useMutation({
    mutationFn: (vars: { id: string; decision: "approved" | "rejected" | "under_review" }) =>
      decide({
        data: {
          id: vars.id,
          decision: vars.decision,
          note: note.trim() || undefined,
          tickSize: Number(tick),
          lotSize: Number(lot),
        },
      }),
    onSuccess: (r) => {
      toast.success(
        r.status === "approved" ? "Candidatura aprovada e instrumento criado" : "Candidatura atualizada",
      );
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["admin-listings"] });
      queryClient.invalidateQueries({ queryKey: ["exchange-market"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <Skeleton className="h-32 w-full" />;
  const rows = query.data ?? [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label htmlFor="tick" className="text-xs">
            Passo de preço (MZN)
          </Label>
          <Input id="tick" inputMode="decimal" value={tick} onChange={(e) => setTick(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="lot" className="text-xs">
            Lote mínimo
          </Label>
          <Input id="lot" inputMode="numeric" value={lot} onChange={(e) => setLot(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="note" className="text-xs">
            Nota da decisão
          </Label>
          <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      {rows.length === 0 && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Sem candidaturas à listagem.
          </CardContent>
        </Card>
      )}

      {rows.map((r) => (
        <Card key={r.id}>
          <CardContent className="space-y-2 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{r.proposedSymbol}</span>
              <span className="text-sm">{r.companyName}</span>
              <Badge variant="outline" className="text-[10px]">
                {r.assetType}
              </Badge>
              <Badge
                variant={
                  r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"
                }
                className="text-[10px]"
              >
                {STATUS_LABEL[r.status] ?? r.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {r.sector ?? "Setor não indicado"} · {r.contactEmail ?? "sem email"} ·{" "}
              {new Date(r.createdAt).toLocaleDateString("pt-PT")}
            </p>
            {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
            {r.decisionNote && <p className="text-xs text-amber-400">Nota: {r.decisionNote}</p>}
            {r.status !== "approved" && r.status !== "rejected" && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ id: r.id, decision: "approved" })}
                >
                  Aprovar e listar
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ id: r.id, decision: "under_review" })}
                >
                  Em análise
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ id: r.id, decision: "rejected" })}
                >
                  Recusar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

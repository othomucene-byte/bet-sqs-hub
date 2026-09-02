import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BadgeCheck, Clock, ShieldAlert, ShieldCheck, Upload, XCircle } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getKyc, registerKycDocument, submitKyc } from "@/lib/investments/kyc.functions";

export const Route = createFileRoute("/_authenticated/kyc")({
  head: () => ({
    meta: [
      { title: "Verificação de identidade (KYC) — BETFCOM SQs" },
      {
        name: "description",
        content:
          "Submete os teus dados e documentos para verificação de identidade. A aprovação do KYC é obrigatória antes de subscrever produtos de investimento.",
      },
      { property: "og:title", content: "Verificação de identidade — BETFCOM SQs" },
      {
        property: "og:description",
        content: "Dados e documentos revistos pelo backoffice antes de qualquer subscrição.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KycPage,
});

const statusMeta: Record<string, { label: string; tone: string; icon: typeof ShieldCheck }> = {
  not_started: { label: "Não iniciado", tone: "bg-muted text-muted-foreground", icon: ShieldAlert },
  pending: { label: "Em análise", tone: "bg-amber-500/15 text-amber-500", icon: Clock },
  approved: { label: "Aprovado", tone: "bg-primary/15 text-primary", icon: BadgeCheck },
  rejected: { label: "Recusado", tone: "bg-destructive/15 text-destructive", icon: XCircle },
};

const docLabels: Record<string, string> = {
  id_front: "Documento (frente)",
  id_back: "Documento (verso)",
  selfie: "Selfie com documento",
  proof_address: "Comprovativo de morada",
  other: "Outro",
};

function KycPage() {
  const queryClient = useQueryClient();
  const fetchKyc = useServerFn(getKyc);
  const doSubmit = useServerFn(submitKyc);
  const doRegister = useServerFn(registerKycDocument);

  const kyc = useQuery({ queryKey: ["kyc"], queryFn: () => fetchKyc() });

  const [form, setForm] = useState({
    fullName: "",
    documentType: "bi",
    documentNumber: "",
    dateOfBirth: "",
    address: "",
    province: "",
    nationality: "Moçambique",
    riskProfile: "moderado",
  });
  const [docType, setDocType] = useState("id_front");
  const [uploading, setUploading] = useState(false);

  const current = kyc.data;
  const status = current?.status ?? "not_started";
  const meta = statusMeta[status] ?? statusMeta["not_started"]!;
  const StatusIcon = meta.icon;
  const locked = status === "approved";

  const submitMutation = useMutation({
    mutationFn: async () =>
      doSubmit({
        data: {
          fullName: form.fullName,
          documentType: form.documentType as "bi" | "passaporte" | "dire" | "carta_conducao",
          documentNumber: form.documentNumber,
          dateOfBirth: form.dateOfBirth,
          address: form.address,
          province: form.province,
          nationality: form.nationality,
          riskProfile: form.riskProfile as "conservador" | "moderado" | "arrojado",
        },
      }),
    onSuccess: () => {
      toast.success("Dados submetidos. O backoffice vai revê-los.");
      queryClient.invalidateQueries({ queryKey: ["kyc"] });
      queryClient.invalidateQueries({ queryKey: ["investor-overview"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível submeter."),
  });

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const { data: session } = await supabase.auth.getUser();
      const uid = session.user?.id;
      if (!uid) throw new Error("Sessão expirada.");
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${uid}/${docType}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("kyc").upload(path, file, { upsert: false });
      if (error) throw new Error(error.message);
      await doRegister({ data: { docType: docType as "id_front", storagePath: path } });
      toast.success("Documento enviado.");
      queryClient.invalidateQueries({ queryKey: ["kyc"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no envio do documento.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 pb-20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold sm:text-3xl">
              Verificação de identidade
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Obrigatória antes de subscrever qualquer produto de investimento.
            </p>
          </div>
          <Badge className={meta.tone}>
            <StatusIcon className="mr-1 size-3.5" /> {meta.label}
          </Badge>
        </div>

        {status === "rejected" && current?.reviewNotes ? (
          <Card className="mt-6 border-destructive/40">
            <CardHeader>
              <CardTitle className="text-base">Motivo da recusa</CardTitle>
              <CardDescription>{current.reviewNotes}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados do titular</CardTitle>
              <CardDescription>
                Os dados são revistos por uma pessoa do backoffice. Nada é aprovado automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  disabled={locked}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder={current?.fullName ?? "Nome como consta no documento"}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Tipo de documento</Label>
                  <Select
                    value={form.documentType}
                    disabled={locked}
                    onValueChange={(v) => setForm({ ...form, documentType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bi">BI</SelectItem>
                      <SelectItem value="passaporte">Passaporte</SelectItem>
                      <SelectItem value="dire">DIRE</SelectItem>
                      <SelectItem value="carta_conducao">Carta de condução</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="documentNumber">Número do documento</Label>
                  <Input
                    id="documentNumber"
                    value={form.documentNumber}
                    disabled={locked}
                    onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
                    placeholder={current?.documentNumber ?? "0000000000000A"}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="dob">Data de nascimento</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={form.dateOfBirth}
                    disabled={locked}
                    onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="province">Província</Label>
                  <Input
                    id="province"
                    value={form.province}
                    disabled={locked}
                    onChange={(e) => setForm({ ...form, province: e.target.value })}
                    placeholder={current?.province ?? "Maputo"}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Morada</Label>
                <Input
                  id="address"
                  value={form.address}
                  disabled={locked}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder={current?.address ?? "Av. 24 de Julho, nº 100"}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="nationality">Nacionalidade</Label>
                  <Input
                    id="nationality"
                    value={form.nationality}
                    disabled={locked}
                    onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Perfil de risco</Label>
                  <Select
                    value={form.riskProfile}
                    disabled={locked}
                    onValueChange={(v) => setForm({ ...form, riskProfile: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conservador">Conservador</SelectItem>
                      <SelectItem value="moderado">Moderado</SelectItem>
                      <SelectItem value="arrojado">Arrojado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={locked || submitMutation.isPending}
              >
                {status === "not_started" ? "Submeter para análise" : "Actualizar e reenviar"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Investir envolve risco de perda de capital. Nenhum retorno é garantido.
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Documentos</CardTitle>
                <CardDescription>
                  Ficheiros guardados em armazenamento privado — só tu e o backoffice têm acesso.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Select value={docType} onValueChange={setDocType} disabled={locked}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(docLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Label
                  htmlFor="kyc-file"
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border py-6 text-sm text-muted-foreground hover:bg-secondary"
                >
                  <Upload className="size-4" />
                  {uploading ? "A enviar…" : "Escolher ficheiro"}
                </Label>
                <Input
                  id="kyc-file"
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  disabled={locked || uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUpload(file);
                    e.target.value = "";
                  }}
                />
                <ul className="grid gap-1.5 text-sm">
                  {(current?.documents ?? []).map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between">
                      <span>{docLabels[doc.docType] ?? doc.docType}</span>
                      <Badge variant="outline">{doc.status}</Badge>
                    </li>
                  ))}
                  {(current?.documents ?? []).length === 0 ? (
                    <li className="text-muted-foreground">Nenhum documento enviado.</li>
                  ) : null}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Depois da aprovação</CardTitle>
                <CardDescription>
                  Com o KYC aprovado passas a poder subscrever produtos e pedir resgates.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" asChild>
                  <Link to="/investidor">Ir para o painel do investidor</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

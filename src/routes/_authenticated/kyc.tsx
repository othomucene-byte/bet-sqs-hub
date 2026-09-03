import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BadgeCheck,
  Clock,
  Loader2,
  ScanFace,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  XCircle,
} from "lucide-react";

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
import { runKycReview, type KycReviewOutcome } from "@/lib/investments/kyc-review.functions";

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
  id_front: "BI — frente",
  id_back: "BI — verso",
  selfie: "Selfie com documento",
  proof_address: "Comprovativo de morada",
  other: "Outro",
};

function KycPage() {
  const queryClient = useQueryClient();
  const fetchKyc = useServerFn(getKyc);
  const doSubmit = useServerFn(submitKyc);
  const doRegister = useServerFn(registerKycDocument);
  const doReview = useServerFn(runKycReview);

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
  const [docType, setDocType] = useState<"id_front" | "id_back">("id_front");
  const [review, setReview] = useState<KycReviewOutcome | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const reviewMutation = useMutation({
    mutationFn: async () => doReview({ data: {} }),
    onSuccess: (result) => {
      setReview(result);
      if (!result.ok) {
        toast.error(result.error ?? "A verificação automática não concluiu.");
      } else if (result.status === "approved") {
        toast.success("Oséias verificou a tua identidade: aprovada.");
      } else if (result.status === "rejected") {
        toast.error("Oséias recusou a verificação. Vê as observações.");
      } else {
        toast.info("Oséias encaminhou o teu caso para análise humana.");
      }
      void queryClient.invalidateQueries({ queryKey: ["kyc"] });
      void queryClient.invalidateQueries({ queryKey: ["investor-overview"] });
    },
    onError: () => toast.error("Não foi possível correr a verificação automática."),
  });

  const docTypes = new Set((current?.documents ?? []).map((doc) => doc.docType));
  const missingSteps = [
    !current ? "submeter os teus dados" : null,
    !docTypes.has("id_front") ? "a foto da frente do BI" : null,
    !docTypes.has("id_back") ? "a foto do verso do BI" : null,
  ].filter(Boolean) as string[];
  const readyForReview = missingSteps.length === 0;

  async function handleUpload(file: File, type: "id_front" | "id_back" = docType) {
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
                O Oséias, assistente de verificação automática, analisa os dados e os documentos. Casos duvidosos seguem para análise humana.
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
            <Card className="border-primary/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ScanFace className="size-4 text-primary" /> Oséias — verificação automática
                </CardTitle>
                <CardDescription>
                  Analisa o documento e a selfie e devolve o resultado em minutos (normalmente 3 a 5).
                  A decisão é aplicada no servidor; qualquer dúvida vai para análise humana.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Button
                  onClick={() => reviewMutation.mutate()}
                  disabled={locked || !readyForReview || reviewMutation.isPending}
                >
                  {reviewMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" /> A verificar…
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 size-4" /> Verificar com o Oséias
                    </>
                  )}
                </Button>
                {!readyForReview && !locked ? (
                  <p className="text-xs text-muted-foreground">
                    Falta {missingSteps.join(", ")}. Escolhe o tipo de documento em baixo e carrega a
                    imagem.
                  </p>
                ) : null}
                {review ? (
                  <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm">
                    <p className="font-semibold">
                      {review.ok
                        ? review.status === "approved"
                          ? "Identidade verificada"
                          : review.status === "rejected"
                            ? "Verificação recusada"
                            : "Enviado para análise humana"
                        : "Verificação não concluída"}
                    </p>
                    <p className="mt-1 text-muted-foreground">{review.summary ?? review.error}</p>
                    {review.issues && review.issues.length > 0 ? (
                      <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground">
                        {review.issues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
                {current?.reviewNotes && !review ? (
                  <p className="whitespace-pre-line text-xs text-muted-foreground">
                    {current.reviewNotes}
                  </p>
                ) : null}
              </CardContent>
            </Card>

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
                <Button
                  type="button"
                  variant="outline"
                  disabled={locked || uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="h-auto justify-center gap-2 border-dashed py-6 text-sm text-muted-foreground"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> A enviar…
                    </>
                  ) : (
                    <>
                      <Upload className="size-4" /> Escolher ficheiro ou tirar foto
                    </>
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  id="kyc-file"
                  type="file"
                  accept="image/*,application/pdf"
                  className="sr-only"
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

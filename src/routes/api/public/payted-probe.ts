import { createFileRoute } from "@tanstack/react-router";

/**
 * TEMPORÁRIO (diagnóstico): envia um débito propositadamente inválido
 * (número "123") para a PayTED devolver os erros de validação por campo.
 * Nenhuma cobrança acontece: a validação falha antes de qualquer débito.
 * APAGAR após o diagnóstico.
 */
export const Route = createFileRoute("/api/public/payted-probe")({
  server: {
    handlers: {
      GET: async () => {
        const secret = process.env["PAYTED_SECRET_KEY"];
        const appId = process.env["PAYTED_APP_ID"];
        if (!secret) return Response.json({ configured: false });
        const res = await fetch("https://pay.ted.co.mz/api/debit", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify({
            app_id: Number(appId ?? 0),
            valor_total: 20,
            referencia_externa: `probe_${Date.now()}`,
            metodo: "emola",
            numero_cliente: "123",
          }),
        });
        const data = await res.json().catch(() => null);
        return Response.json({
          httpStatus: res.status,
          appIdNumeric: Number.isFinite(Number(appId)) && String(Number(appId)) !== "NaN",
          response: data,
        });
      },
    },
  },
});

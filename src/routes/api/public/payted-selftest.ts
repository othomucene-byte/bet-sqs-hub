import { createFileRoute } from "@tanstack/react-router";

/**
 * TEMPORÁRIO — auto-teste de conectividade PayTED. Apagar após validação.
 * Faz uma consulta de referência inexistente: uma resposta "não encontrado"
 * prova que as chaves autenticam; 401/403 indicaria credenciais inválidas.
 */
export const Route = createFileRoute("/api/public/payted-selftest")({
  server: {
    handlers: {
      GET: async () => {
        const { isPaytedConfigured, getPaytedPaymentByReference } = await import(
          "@/lib/payments/payted.server"
        );
        if (!isPaytedConfigured()) {
          return Response.json({ configured: false }, { status: 503 });
        }
        try {
          const result = await getPaytedPaymentByReference("selftest-referencia-inexistente");
          return Response.json({ configured: true, reachable: true, result });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const authFailed = /401|403|unauthor|invalid.*key|token/i.test(message);
          return Response.json(
            { configured: true, reachable: !authFailed, authFailed, error: message.slice(0, 300) },
            { status: authFailed ? 502 : 200 },
          );
        }
      },
    },
  },
});

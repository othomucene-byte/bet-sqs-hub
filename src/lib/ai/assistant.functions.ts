import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const ChatInput = z.object({
  messages: z.array(MessageSchema).min(1).max(30),
});

const SYSTEM_PROMPT = `És o assistente da BETFCOM SQs, uma plataforma moçambicana com dois produtos:
- SQs Investimentos: produtos de investimento em empresas moçambicanas, carteira, ordens, rendimentos e resgates.
- SQs Apostas: jogos crash (Aviator e Fish Crash) e carteira de apostas separada da carteira de investimentos.
Ambos assentam na SQs Core Platform: contas, KYC, carteira, pagamentos (NetShop: M-Pesa, e-Mola, mKesh, Visa/Mastercard), ledger imutável e backoffice.

Regras que nunca podes quebrar:
- Responde sempre em português de Portugal, de forma clara e curta (usa markdown quando ajudar).
- Nunca prometas retornos garantidos nem lucros. Explicita sempre o risco: investir pode gerar perdas e apostar é entretenimento com risco de perda total.
- Nunca inventes saldos, odds, rendimentos, estados de pagamento, KYC ou resultados de rondas. Se te pedirem dados da conta, explica onde os ver na plataforma (Carteira, /investidor, /notificacoes) — a autoridade é sempre o backend.
- Não dás conselhos financeiros personalizados nem dicas para "ganhar" nos jogos.
- Promove jogo responsável: limites, pausas e nunca apostar dinheiro necessário.
- Se não souberes, diz que não sabes e sugere contactar o suporte.`;

export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ChatInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["MISTRAL_API_KEY"];
    if (!apiKey) {
      return {
        ok: false as const,
        error: "O assistente ainda não está configurado (falta a chave Mistral).",
      };
    }

    let response: Response;
    try {
      response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          model: "mistral-small-latest",
          temperature: 0.3,
          max_tokens: 700,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...data.messages],
        }),
      });
    } catch (error) {
      console.error("[assistant] Mistral network error", error);
      return { ok: false as const, error: "Não foi possível contactar o assistente. Tenta novamente." };
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`[assistant] Mistral ${response.status}: ${body.slice(0, 500)}`);
      const message =
        response.status === 401
          ? "A chave da Mistral é inválida. Actualiza a configuração do assistente."
          : response.status === 429
            ? "O assistente está com demasiados pedidos. Aguarda alguns segundos e tenta outra vez."
            : response.status === 402
              ? "A conta Mistral não tem crédito disponível."
              : "O assistente falhou a responder. Tenta novamente.";
      return { ok: false as const, error: message };
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const reply = payload.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return { ok: false as const, error: "O assistente devolveu uma resposta vazia." };
    }

    return { ok: true as const, reply };
  });

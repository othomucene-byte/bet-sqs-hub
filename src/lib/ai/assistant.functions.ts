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
    const { callGemini } = await import("./gemini.server");
    const result = await callGemini({
      system: SYSTEM_PROMPT,
      contents: data.messages.map((message) => ({
        role: message.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: message.content }],
      })),
      temperature: 0.3,
      maxOutputTokens: 900,
    });

    if (!result.ok) {
      return { ok: false as const, error: result.error };
    }

    const reply = result.text;
    return { ok: true as const, reply };
  });

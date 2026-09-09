/**
 * Camada de inteligência (Mistral AI) do SQs Exchange.
 *
 * Serve exclusivamente para PROPOR dados informativos de empresas (resultados,
 * notícias, dividendos, eventos societários). Nunca toca em saldos, ledger,
 * ordens ou negócios: essas operações são exclusivas do motor no PostgreSQL.
 *
 * A chave (MISTRAL_API_KEY) é do próprio operador da plataforma e só é lida
 * dentro do servidor.
 */

const ENDPOINT = "https://api.mistral.ai/v1/chat/completions";
export const MISTRAL_MODEL = "mistral-large-latest";

export class MistralNotConfigured extends Error {
  constructor() {
    super("Camada de inteligência não configurada: falta a chave da Mistral AI.");
  }
}

export class MistralDenied extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export type MistralMessage = { role: "system" | "user"; content: string };

/** Chamada única, resposta em JSON. Erros são explícitos — nunca inventamos dados. */
export async function callMistralJson(
  messages: MistralMessage[],
  signal?: AbortSignal,
): Promise<unknown> {
  const apiKey = process.env["MISTRAL_API_KEY"];
  if (!apiKey) throw new MistralNotConfigured();

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages,
    }),
    ...(signal ? { signal } : {}),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const message = body.slice(0, 300) || res.statusText;
    // 401/402/403/429 são terminais para o ciclo: o trabalho automático pausa.
    throw new MistralDenied(message, res.status);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("Resposta vazia da camada de inteligência.");
  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new Error("Resposta da camada de inteligência não é JSON válido.");
  }
}

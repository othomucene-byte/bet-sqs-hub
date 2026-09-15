/**
 * Pesquisa fundamentada com a Mistral (Agents API + ferramenta web_search).
 *
 * Server-only: MISTRAL_API_KEY nunca chega ao browser.
 *
 * A Mistral executa a pesquisa web e devolve, na entrada `tool.execution`, as
 * páginas realmente consultadas (título + URL). Só essas ligações são aceites
 * como fonte — nada é assumido a partir da memória do modelo.
 */

import type { GroundedResult, GroundedSource } from "./search-types";
import { AiNotConfigured } from "./search-types";

const API = "https://api.mistral.ai/v1";
const MODELS = ["mistral-medium-latest", "mistral-small-latest"];
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const AGENT_NAME = "betfcom-sqs-research";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const domainOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

type ConversationEntry = {
  type: string;
  name?: string;
  content?: unknown;
  info?: { result?: unknown };
};

/** Cria (ou recria) o agente de pesquisa. Os agentes são baratos e sem estado útil. */
async function createAgent(apiKey: string, model: string, system: string) {
  const response = await fetch(`${API}/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      name: AGENT_NAME,
      instructions: system,
      tools: [{ type: "web_search" }],
    }),
  });
  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    return { ok: false as const, status: response.status, raw };
  }
  const payload = (await response.json()) as { id?: string };
  return payload.id
    ? { ok: true as const, agentId: payload.id }
    : { ok: false as const, status: 502, raw: "agente sem id" };
}

function sourcesFrom(entries: ConversationEntry[]): GroundedSource[] {
  const seen = new Set<string>();
  const sources: GroundedSource[] = [];
  for (const entry of entries) {
    if (entry.type !== "tool.execution") continue;
    const raw = entry.info?.result;
    let parsed: unknown = raw;
    if (typeof raw === "string") {
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }
    }
    if (!parsed || typeof parsed !== "object") continue;
    for (const value of Object.values(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const hit = value as { url?: unknown; title?: unknown };
      const url = typeof hit.url === "string" ? hit.url : null;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      sources.push({
        url,
        title: (typeof hit.title === "string" && hit.title.trim()) || domainOf(url) || "fonte",
        domain: domainOf(url),
      });
    }
  }
  return sources;
}

function textFrom(entries: ConversationEntry[]): string {
  const parts: string[] = [];
  for (const entry of entries) {
    if (entry.type !== "message.output") continue;
    const content = entry.content;
    if (typeof content === "string") parts.push(content);
    else if (Array.isArray(content)) {
      for (const chunk of content) {
        if (chunk && typeof chunk === "object" && typeof (chunk as { text?: unknown }).text === "string") {
          parts.push((chunk as { text: string }).text);
        }
      }
    }
  }
  return parts.join("\n").trim();
}

async function once(
  apiKey: string,
  model: string,
  system: string,
  prompt: string,
): Promise<GroundedResult & { retryable?: boolean }> {
  const agent = await createAgent(apiKey, model, system);
  if (!agent.ok) {
    console.error(`[mistral-search:${model}] agente ${agent.status}: ${agent.raw.slice(0, 300)}`);
    return {
      ok: false,
      status: agent.status,
      error: `Pesquisa recusada pelo fornecedor (${agent.status}).`,
      terminal: [400, 401, 402, 403].includes(agent.status),
      retryable: RETRYABLE.has(agent.status),
    };
  }

  let response: Response;
  try {
    response = await fetch(`${API}/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ agent_id: agent.agentId, inputs: prompt, store: false }),
    });
  } catch (error) {
    console.error(`[mistral-search:${model}] rede`, error);
    return {
      ok: false,
      error: "Não foi possível contactar o serviço de pesquisa.",
      terminal: false,
      retryable: true,
    };
  }

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    console.error(`[mistral-search:${model}] ${response.status}: ${raw.slice(0, 300)}`);
    return {
      ok: false,
      status: response.status,
      error: `Pesquisa recusada pelo fornecedor (${response.status}).`,
      terminal: [400, 401, 402, 403].includes(response.status),
      retryable: RETRYABLE.has(response.status),
    };
  }

  const payload = (await response.json()) as { outputs?: ConversationEntry[] };
  const entries = payload.outputs ?? [];
  const text = textFrom(entries);
  if (!text) {
    return { ok: false, error: "A pesquisa devolveu uma resposta vazia.", terminal: false, retryable: true };
  }
  return { ok: true, text, sources: sourcesFrom(entries), model: `mistral:${model}`, queries: [] };
}

/** Pesquisa web real com a Mistral. Sem chave → AiNotConfigured (o trabalho pausa). */
export async function mistralGroundedSearch({
  system,
  prompt,
}: {
  system: string;
  prompt: string;
}): Promise<GroundedResult> {
  const apiKey = process.env["MISTRAL_API_KEY"];
  if (!apiKey) throw new AiNotConfigured("Falta a chave da Mistral (MISTRAL_API_KEY).");

  let last: GroundedResult = {
    ok: false,
    error: "O serviço de pesquisa falhou a responder.",
    terminal: false,
  };

  for (const model of MODELS) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await once(apiKey, model, system, prompt);
      if (result.ok) return result;
      last =
        result.status === undefined
          ? { ok: false, error: result.error, terminal: result.terminal }
          : { ok: false, status: result.status, error: result.error, terminal: result.terminal };
      if (result.terminal) return last;
      if (!result.retryable) break;
      if (attempt < 2) await sleep(900 * 2 ** attempt + Math.random() * 400);
    }
  }
  return last;
}

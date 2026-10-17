// Edge Function "coach": recebe a conversa montada pelo app e devolve a resposta do Claude em streaming.
// Só aceita usuários logados (verify_jwt) e usa a chave guardada no segredo ANTHROPIC_API_KEY.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";

const MODEL = "claude-opus-5-5";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const IMG_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

type Turn = { role: "user" | "assistant"; content: string };
type Img = { media_type: string; data: string };
type Body = { messages?: Turn[]; images?: Img[]; effort?: string; json?: boolean };

function erro(code: string, status: number) {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function codigoDoErro(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return "bad_key";
  if (e instanceof Anthropic.RateLimitError) return "rate_limited";
  if (e instanceof Anthropic.BadRequestError) return "invalid_request";
  if (e instanceof Anthropic.APIError) return "upstream_error";
  return "upstream_error";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return erro("invalid_request", 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return erro("no_key", 503);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return erro("invalid_request", 400);
  }
  const turns = (body.messages || []).filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim());
  if (!turns.length || turns[turns.length - 1].role !== "user") return erro("invalid_request", 400);
  if (JSON.stringify(turns).length > 600_000) return erro("prompt_too_large", 413);

  // Turnos seguidos do mesmo papel são unidos; as imagens vão junto com a última mensagem do usuário.
  const messages: Anthropic.MessageParam[] = [];
  for (const t of turns) {
    const last = messages[messages.length - 1];
    if (last && last.role === t.role) last.content = `${last.content}\n\n${t.content}`;
    else messages.push({ role: t.role, content: t.content });
  }
  const imgs = (body.images || []).filter((i) => i && IMG_TYPES.includes(i.media_type) && typeof i.data === "string").slice(0, 4);
  if (imgs.length) {
    const last = messages[messages.length - 1];
    last.content = [
      ...imgs.map((i) => ({ type: "image" as const, source: { type: "base64" as const, media_type: i.media_type as "image/jpeg", data: i.data } })),
      { type: "text" as const, text: String(last.content) },
    ];
  }
  if (body.json) {
    const last = messages[messages.length - 1];
    const aviso = "\n\nResponda somente com o JSON pedido, sem nenhum texto antes ou depois.";
    if (typeof last.content === "string") last.content += aviso;
    else last.content.push({ type: "text", text: aviso.trim() });
  }
  const effort = body.effort === "low" || body.effort === "high" ? body.effort : "medium";

  const client = new Anthropic({ apiKey });
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        const s = client.beta.messages.stream(
          {
            model: MODEL,
            max_tokens: 16000,
            output_config: { effort },
            messages,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
          } as unknown as Parameters<typeof client.beta.messages.stream>[0],
          { signal: req.signal },
        );
        for await (const ev of s) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") send({ d: ev.delta.text });
        }
        const final = await s.finalMessage();
        if (final.stop_reason === "refusal") send({ error: "refused" });
        else send({ done: true, truncated: final.stop_reason === "max_tokens" });
      } catch (e) {
        if (!req.signal.aborted) {
          console.error("coach:", e instanceof Error ? e.message : e);
          send({ error: codigoDoErro(e) });
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { ...CORS, "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
});

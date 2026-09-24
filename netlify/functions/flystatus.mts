/**
 * Is the fly brain training right now?
 *
 * The machine doing the training posts a short status here every couple of
 * minutes; /aiflybrain reads it and shows whether the brain is learning at
 * this moment, and how far it has got.
 *
 * Writing needs FLY_STATUS_KEY set in the project's environment variables, and
 * the same key sent as x-fly-key. Without the variable no one can write, and
 * the page falls back to the figures baked into the published data.
 */
import { getStore } from "@netlify/blobs";

const KEY = "status";
const MAX_BODY = 256 * 1024;

export default async (req: Request) => {
  const store = getStore({ name: "aiflybrain", consistency: "strong" });

  if (req.method === "GET") {
    const s: any = (await store.get(KEY, { type: "json" })) ?? null;
    const age = s?.updated_at ? (Date.now() - new Date(s.updated_at).getTime()) / 1000 : null;
    return Response.json({ status: s, age_s: age === null ? null : Math.round(age) },
      { headers: { "cache-control": "no-store" } });
  }

  if (req.method === "POST") {
    const key = Netlify.env.get("FLY_STATUS_KEY") || "";
    if (!key || req.headers.get("x-fly-key") !== key) {
      return new Response("nope", { status: 401 });
    }
    const text = await req.text();
    if (text.length > MAX_BODY) return new Response("too big", { status: 413 });
    let body: any;
    try { body = JSON.parse(text); } catch { return new Response("bad json", { status: 400 }); }
    const clean = {
      running: !!body.running,
      minutes: Number(body.minutes) || 0,
      chars_seen: Number(body.chars_seen) || 0,
      loss: body.loss === null || body.loss === undefined ? null : Number(body.loss),
      rate: Number(body.rate) || 0,
      chars_per_s: Number(body.chars_per_s) || 0,
      eval: typeof body.eval === "object" && body.eval ? body.eval : {},
      probes: typeof body.probes === "object" && body.probes ? body.probes : {},
      note: String(body.note || "").slice(0, 200),
      history: Array.isArray(body.history) ? body.history.slice(-400) : [],
      updated_at: new Date().toISOString(),
    };
    await store.setJSON(KEY, clean);
    return Response.json({ ok: true });
  }

  return new Response("method not allowed", { status: 405 });
};

export const config = { path: "/api/flystatus" };

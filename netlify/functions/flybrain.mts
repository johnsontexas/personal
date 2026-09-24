/**
 * The newest brain, uploaded straight from the machine that trains it.
 *
 * The page ships with a brain baked into /aiflybrain/data, but the brain keeps
 * learning long after that was published. Rather than redeploying the site for
 * every improvement, the training machine posts the new synapse strengths here
 * (~2 MB) and the page picks them up on the next load.
 *
 * GET  /api/flybrain?meta=1  -> { chars_seen, minutes, iter, bytes } or null
 * GET  /api/flybrain         -> the raw weights
 * POST /api/flybrain         -> upload (needs FLY_STATUS_KEY as x-fly-key)
 */
import { getStore } from "@netlify/blobs";

const KEY = "brain";
const MAX_BYTES = 12 * 1024 * 1024;

export default async (req: Request) => {
  const store = getStore({ name: "aiflybrain", consistency: "strong" });
  const url = new URL(req.url);

  if (req.method === "GET") {
    const res = await store.getWithMetadata(KEY, { type: "arrayBuffer" }).catch(() => null);
    if (!res) return url.searchParams.has("meta")
      ? Response.json(null, { headers: { "cache-control": "no-store" } })
      : new Response("no brain uploaded yet", { status: 404 });
    const m: any = res.metadata || {};
    if (url.searchParams.has("meta")) {
      return Response.json({ ...m, bytes: res.data.byteLength },
        { headers: { "cache-control": "no-store" } });
    }
    return new Response(res.data, {
      headers: {
        "content-type": "application/octet-stream",
        "cache-control": "no-store",
        "x-chars-seen": String(m.chars_seen ?? 0),
        "x-minutes": String(m.minutes ?? 0),
      },
    });
  }

  if (req.method === "POST") {
    const key = Netlify.env.get("FLY_STATUS_KEY") || "";
    if (!key || req.headers.get("x-fly-key") !== key) return new Response("nope", { status: 401 });
    const body = await req.arrayBuffer();
    if (!body.byteLength || body.byteLength > MAX_BYTES) {
      return new Response("bad size", { status: 413 });
    }
    const num = (h: string) => Number(req.headers.get(h) || 0) || 0;
    await store.set(KEY, body, {
      metadata: {
        chars_seen: num("x-chars-seen"), minutes: num("x-minutes"), iter: num("x-iter"),
        uploaded_at: new Date().toISOString(),
      },
    });
    return Response.json({ ok: true, bytes: body.byteLength });
  }

  return new Response("method not allowed", { status: 405 });
};

export const config = { path: "/api/flybrain" };

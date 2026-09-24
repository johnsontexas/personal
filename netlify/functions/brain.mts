/**
 * The shared fly brain.
 *
 * One blob holds the mushroom body's 62,261 KC->MBON weights, quantised to a
 * byte each (~62 KB). A browser that finishes a game sends its current weights
 * and the weights it started from; this adds the difference to whatever is
 * stored now, rather than overwriting it, so two people finishing a game at
 * the same moment both count.
 *
 * There are no transactions in Blobs, so a genuinely simultaneous pair of
 * writes can still lose one. Strong consistency narrows the window, and
 * losing the occasional game's worth of learning is harmless here -- the
 * signal is incremental and noisy by nature.
 */
import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

const KEY = "brain";
const N_SYN = 62261;          // anything else is not this fly
const MAX_B64 = 200_000;

function decode(b64: unknown): Buffer | null {
  if (typeof b64 !== "string" || b64.length > MAX_B64) return null;
  try {
    const buf = Buffer.from(b64, "base64");
    return buf.length === N_SYN ? buf : null;
  } catch {
    return null;
  }
}

export default async (req: Request) => {
  const store = getStore({ name: "flychess", consistency: "strong" });

  if (req.method === "GET") {
    const cur = await store.get(KEY, { type: "json" });
    return Response.json(cur ?? { w: null, games: 0, elo: null, history: [] });
  }
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const now = decode(body?.w);
  const base = decode(body?.base);
  if (!now || !base) return new Response("bad weights", { status: 400 });

  const cur: any = await store.get(KEY, { type: "json" });
  const stored = cur?.w ? decode(cur.w) : null;

  let next: Buffer;
  if (!stored) {
    next = now;                      // first contribution seeds the shared fly
  } else {
    next = Buffer.allocUnsafe(N_SYN);
    for (let i = 0; i < N_SYN; i++) {
      const v = stored[i] + (now[i] - base[i]);
      next[i] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }

  const num = (x: unknown, fallback: number | null) =>
    typeof x === "number" && Number.isFinite(x) ? x : fallback;

  await store.setJSON(KEY, {
    w: next.toString("base64"),
    games: (cur?.games ?? 0) + 1,
    elo: num(body?.elo, cur?.elo ?? null),
    bench: body?.bench ?? cur?.bench ?? null,
    zMean: num(body?.zMean, cur?.zMean ?? null),
    zVar: num(body?.zVar, cur?.zVar ?? null),
    history: Array.isArray(body?.history) ? body.history.slice(-260) : cur?.history ?? [],
    updated: new Date().toISOString(),
  });

  return Response.json({ ok: true, games: (cur?.games ?? 0) + 1 });
};

export const config: Config = { path: "/api/brain" };

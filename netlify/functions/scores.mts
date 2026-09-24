/**
 * The leaderboard.
 *
 * A row is only written for someone who signed in with Google, and only after
 * the ID token they sent has been checked with Google -- otherwise anyone
 * could post any name with any record. The display name comes from that
 * verified token, never from the request body.
 *
 * Needs GOOGLE_CLIENT_ID set in the project's environment variables. Without
 * it the page still plays and still trains; only the leaderboard is off.
 */
import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

const KEY = "scores";

async function verify(credential: string, clientId: string) {
  if (!credential || credential.length > 4096) return null;
  let res: Response;
  try {
    res = await fetch(
      "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential),
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const t: any = await res.json().catch(() => null);
  if (!t || t.aud !== clientId || !t.sub) return null;
  if (t.exp && Number(t.exp) * 1000 < Date.now()) return null;
  const name = String(t.name || t.given_name || "Player").slice(0, 40);
  return { sub: String(t.sub), name };
}

export default async (req: Request) => {
  const store = getStore({ name: "flychess", consistency: "strong" });
  const clientId = Netlify.env.get("GOOGLE_CLIENT_ID") || "";

  if (req.method === "GET") {
    const all: any = (await store.get(KEY, { type: "json" })) ?? {};
    const players = Object.entries(all)
      .map(([id, v]: [string, any]) => ({
        id,
        name: String(v?.name ?? "Player"),
        w: v?.w | 0,
        d: v?.d | 0,
        l: v?.l | 0,
      }))
      .sort((a, b) => b.w - a.w || a.l - b.l)
      .slice(0, 25);
    return Response.json({ players, clientId });
  }
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }
  if (!clientId) {
    return new Response("sign-in is not configured on this site", { status: 503 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const who = await verify(String(body?.credential ?? ""), clientId);
  if (!who) return new Response("could not verify that sign-in", { status: 401 });

  const result = Number(body?.result);
  if (![-1, 0, 1].includes(result)) return new Response("bad result", { status: 400 });

  const all: any = (await store.get(KEY, { type: "json" })) ?? {};
  const cur = all[who.sub] ?? { w: 0, d: 0, l: 0 };
  // `result` is from the fly's side; the person's is the other way round
  all[who.sub] = {
    name: who.name,
    w: (cur.w | 0) + (result < 0 ? 1 : 0),
    d: (cur.d | 0) + (result === 0 ? 1 : 0),
    l: (cur.l | 0) + (result > 0 ? 1 : 0),
  };
  await store.setJSON(KEY, all);
  return Response.json({ ok: true, you: { name: who.name, ...all[who.sub] } });
};

export const config: Config = { path: "/api/scores" };

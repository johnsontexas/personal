/* The whole fly brain, with the chess circuit lit up inside it.
 *
 * Every dot is one of the 138,625 FlyWire neurons that has a position, seen
 * from the front -- the same view as /aiflybrain. The mushroom body the fly
 * plays with sits where it really is: projection neurons in the antennal
 * lobes, Kenyon cells above them in the calyx, output neurons (MBONs) along
 * the lobes, and the PAM and PPL1 dopamine neurons that teach it.
 *
 * When the fly smells a position the signal is drawn as it travels, along
 * real synapses from fly.bin: projection neuron -> Kenyon cell -> MBON. When
 * dopamine arrives the dopamine neurons that write to the active MBONs flash:
 * PAM for better than expected, PPL1 for worse.
 */

const G = { optic: 0, brain: 1, pn: 2, kc: 3, mbon: 4, pam: 5, ppl1: 6, apl: 7 };

export async function loadAtlas(url) {
  const buf = await (await fetch(url)).arrayBuffer();
  const dv = new DataView(buf);
  const magic = new TextDecoder().decode(new Uint8Array(buf, 0, 8));
  if (magic !== "FLYATLAS") throw new Error("not a fly atlas: " + magic);
  const aspect = dv.getInt32(12, true) / 1e6, n = dv.getInt32(16, true);
  let o = 20;
  const count = [];
  for (let g = 0; g < n; g++) { count.push(dv.getInt32(o, true)); o += 4; }
  const xy = [];
  for (let g = 0; g < n; g++) {
    xy.push(new Uint16Array(buf.slice(o, o + count[g] * 4)));
    o += count[g] * 4;
  }
  const nDan = count[G.pam] + count[G.ppl1];
  const danMbon = new Int16Array(buf.slice(o, o + nDan * 2));
  return { aspect, count, xy, danMbon };
}

const COL = {
  optic: .05, brain: .11,                 // ink alpha at 600 px wide, see background()
  pn: [47, 138, 124], kc: [184, 106, 38], kcRest: "rgba(184,106,38,.2)",
  app: [94, 154, 98], avo: [204, 90, 66], pam: [201, 162, 39], ppl1: [107, 79, 160],
  apl: [74, 106, 138], ink: "#202b33", dim: "#737b83",
};
const VIEWS = {
  // x0, y0, x1, y1 in atlas units (0..4000 across the brain)
  whole: [0, 0, 4000, 4000],
  circuit: [1350, 380, 3000, 2850],     // projection neurons to Kenyon cells, 2-98th pct
};

export class BrainViewer {
  constructor(canvas, atlas, B) {
    this.cv = canvas; this.cx = canvas.getContext("2d");
    this.A = atlas; this.B = B;
    this.nPn = atlas.count[G.pn]; this.nKc = atlas.count[G.kc]; this.nMb = atlas.count[G.mbon];
    this.nPam = atlas.count[G.pam]; this.nPpl = atlas.count[G.ppl1];
    this.gPn = new Float32Array(this.nPn);
    this.gKc = new Float32Array(this.nKc);
    this.gMb = new Float32Array(this.nMb);
    this.gDan = new Float32Array(this.nPam + this.nPpl);
    // what the last sniff leaves behind: glow fades down to this, not to
    // nothing, so the position the fly chose stays readable until the next
    this.hPn = new Float32Array(this.nPn);
    this.hKc = new Float32Array(this.nKc);
    this.hMb = new Float32Array(this.nMb);
    this.gApl = 0;
    this.edges = [];            // [x0, y0, x1, y1, colour, strength, born]
    this.view = "whole";
    this.box = VIEWS.whole.slice();
    this.target = VIEWS.whole.slice();
    this.running = false;
    this.labels = this.centroids();
    this.reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.fit();
  }

  /* where to write each population's name: its centroid, per side */
  centroids() {
    const out = [];
    const add = (g, name, split, dy) => {
      const xy = this.A.xy[g], n = xy.length / 2;
      const acc = [[0, 0, 0], [0, 0, 0]];
      for (let i = 0; i < n; i++) {
        const s = split && xy[2 * i] > 2000 ? 1 : 0;
        acc[s][0] += xy[2 * i]; acc[s][1] += xy[2 * i + 1]; acc[s][2]++;
      }
      for (const a of acc) if (a[2]) out.push({ name, x: a[0] / a[2], y: a[1] / a[2] + (dy || 0) });
    };
    add(G.pn, "antennal lobe", true, 330);
    add(G.kc, "Kenyon cells", true, -380);
    add(G.pam, "PAM dopamine", false, 0);
    return out;
  }

  setView(v) { this.view = v; this.target = VIEWS[v].slice(); if (this.reduce) this.box = this.target.slice(); this.fit(); this.kick(); }

  fit() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = this.cv.clientWidth || 600;
    const [x0, y0, x1, y1] = this.target;
    const h = Math.round(w * ((y1 - y0) / (x1 - x0)) * this.A.aspect);
    this.cv.style.height = h + "px";
    this.cv.width = w * dpr; this.cv.height = h * dpr;
    this.dpr = dpr; this.W = w; this.H = h;
    this.bg = null;
    this.draw();
  }

  /* atlas units -> canvas pixels for the current box */
  X(x) { const [x0, , x1] = this.box; return (x - x0) / (x1 - x0) * this.W; }
  Y(y) { const [, y0, , y1] = this.box; return (y - y0) / (y1 - y0) * this.H; }
  P(g, i) { const xy = this.A.xy[g]; return [this.X(xy[2 * i]), this.Y(xy[2 * i + 1])]; }

  /* the brain that never changes, drawn once per view */
  background() {
    const off = document.createElement("canvas");
    off.width = this.cv.width; off.height = this.cv.height;
    const o = off.getContext("2d");
    o.scale(this.dpr, this.dpr);
    const zoom = 4000 / (this.box[2] - this.box[0]);
    const r = Math.min(1.6, 0.9 * Math.pow(zoom, 0.3));
    const dots = (g, col, rr) => {
      o.fillStyle = col;
      const xy = this.A.xy[g];
      for (let i = 0; i < xy.length; i += 2) {
        const x = this.X(xy[i]), y = this.Y(xy[i + 1]);
        if (x < -2 || y < -2 || x > this.W + 2 || y > this.H + 2) continue;
        o.fillRect(x, y, rr, rr);
      }
    };
    // 138,625 dots either saturate a small plate or vanish on a large one:
    // scale the ink with how many neurons land on each pixel
    const dens = Math.min(2.2, Math.pow(this.W / 600, 1.4));
    dots(G.optic, `rgba(32,43,51,${COL.optic * dens})`, r);
    dots(G.brain, `rgba(32,43,51,${COL.brain * dens})`, r);
    dots(G.kc, COL.kcRest, r * 1.1);
    dots(G.pn, "rgba(47,138,124,.35)", r * 1.3);
    dots(G.pam, "rgba(201,162,39,.7)", r * 1.6);
    dots(G.ppl1, "rgba(107,79,160,.6)", r * 2);
    for (let j = 0; j < this.nMb; j++) {
      const [x, y] = this.P(G.mbon, j);
      o.beginPath(); o.arc(x, y, 1.6 + r, 0, 6.283);
      o.strokeStyle = this.B.sign[j] > 0 ? "rgba(94,154,98,.55)" : "rgba(204,90,66,.55)";
      o.lineWidth = 1; o.stroke();
    }
    // on a phone-sized whole brain the names cover what they name
    const showLabels = this.W >= 520 || this.view !== "whole";
    o.font = `${this.view === "whole" ? 9.5 : 10.5}px "IBM Plex Mono", ui-monospace, monospace`;
    o.textAlign = "center"; o.fillStyle = COL.dim;
    if (showLabels) for (const l of this.labels) {
      const x = this.X(l.x), y = this.Y(l.y);
      if (x > 30 && x < this.W - 30 && y > 8 && y < this.H - 4) o.fillText(l.name, x, y);
    }
    this.bg = off;
  }

  /* One sniff: the projection-neuron rates for a position and the mushroom
     body's response to it (brain.last). */
  think(pn, last, maxHz) {
    if (!last) return;
    const B = this.B, now = performance.now();
    this.hPn.fill(0); this.hKc.fill(0); this.hMb.fill(0);
    for (let i = 0; i < this.nPn; i++) {
      const g = Math.min(1, pn[i] / maxHz);
      if (g > this.gPn[i]) this.gPn[i] = g;
      this.hPn[i] = g * 0.3;
    }
    this.gApl = 1;
    // the strongest few active Kenyon cells: draw the synapses that drove
    // them and the ones they drive, as the signal would travel
    const order = Array.from(last.active.keys()).sort((a, b) => last.act[b] - last.act[a]);
    const top = order.slice(0, 70);
    this.edges = this.edges.filter(e => now - e[6] < 900);
    for (const q of top) {
      const i = last.active[q];
      let bp = -1, bv = 0;
      for (let k = B.pkPtr[i]; k < B.pkPtr[i + 1]; k++) {
        const v = B.pkW[k] * pn[B.pkPre[k]];
        if (v > bv) { bv = v; bp = B.pkPre[k]; }
      }
      if (bp >= 0) this.edges.push([G.pn, bp, G.kc, i, COL.pn, 0.5, now]);
      let bm = -1, bw = 0;
      for (let e = B.kmPtr[i]; e < B.kmPtr[i + 1]; e++) {
        if (B.kmW[e] > bw) { bw = B.kmW[e]; bm = B.kmPost[e]; }
      }
      if (bm >= 0) this.edges.push([G.kc, i, G.mbon, bm, B.sign[bm] > 0 ? COL.app : COL.avo, 0.6, now + 90]);
    }
    for (let q = 0; q < last.active.length; q++) {
      const i = last.active[q];
      const g = Math.min(1, 0.45 + last.act[q] * 0.35);
      this.gKc[i] = Math.max(this.gKc[i], g);
      this.hKc[i] = g * 0.45;
    }
    let mx = 1e-9;
    for (const r of last.mbon) mx = Math.max(mx, Math.abs(r));
    for (let j = 0; j < this.nMb; j++) {
      const g = Math.abs(last.mbon[j]) / mx;
      this.gMb[j] = Math.max(this.gMb[j], g);
      this.hMb[j] = g * 0.6;
    }
    this.kick();
  }

  /* Dopamine: reward prediction error. PAM neurons signal better than
     expected, PPL1 worse; the ones that write to the MBONs that just voted
     light up hardest. */
  dopamine(delta) {
    const s = Math.min(1, Math.abs(delta) * 1.6);
    if (s < 0.02) return;
    const pos = delta > 0, dm = this.A.danMbon;
    const lo = pos ? 0 : this.nPam, hi = pos ? this.nPam : this.nPam + this.nPpl;
    for (let d = lo; d < hi; d++) {
      const m = dm[d];
      const w = m >= 0 ? 0.35 + 0.65 * this.gMb[m] : 0.3;
      this.gDan[d] = Math.max(this.gDan[d], s * w);
    }
    this.kick();
  }

  clear() {
    for (const a of [this.gPn, this.gKc, this.gMb, this.gDan, this.hPn, this.hKc, this.hMb]) a.fill(0);
    this.edges = []; this.kick();
  }

  kick() { if (!this.running) { this.running = true; requestAnimationFrame(() => this.frame()); } }

  frame() {
    // ease the camera towards the chosen view
    let moving = false;
    for (let k = 0; k < 4; k++) {
      const d = this.target[k] - this.box[k];
      if (Math.abs(d) > 0.5) { this.box[k] += d * 0.18; moving = true; this.bg = null; }
      else this.box[k] = this.target[k];
    }
    let alive = this.draw();
    const decay = (a, h, f) => {
      for (let i = 0; i < a.length; i++) {
        const floor = h ? h[i] : 0;
        if (a[i] <= floor) continue;
        const v = a[i] * f;
        a[i] = v - floor < 0.004 ? floor : v;
        alive = true;
      }
    };
    alive = false || this.edges.some(e => performance.now() - e[6] < 700);
    decay(this.gPn, this.hPn, 0.9); decay(this.gKc, this.hKc, 0.94);
    decay(this.gMb, this.hMb, 0.95); decay(this.gDan, null, 0.955);
    this.gApl *= 0.9;
    if (this.gApl > 0.03) alive = true;
    if (alive || moving) requestAnimationFrame(() => this.frame());
    else this.running = false;
  }

  draw() {
    const c = this.cx, dpr = this.dpr, now = performance.now();
    if (!this.bg) this.background();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.cv.width, this.cv.height);
    c.drawImage(this.bg, 0, 0);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // glow sizes follow the zoom, and shrink on a small plate
    const zoom = Math.sqrt(4000 / (this.box[2] - this.box[0])) * Math.min(1, Math.sqrt(this.W / 600));
    let alive = false;

    // synapses in flight
    c.lineWidth = 0.9;
    for (const e of this.edges) {
      const age = (now - e[6]) / 700;
      if (age < 0) { alive = true; continue; }
      if (age > 1) continue;
      alive = true;
      const [x0, y0] = this.P(e[0], e[1]), [x1, y1] = this.P(e[2], e[3]);
      const t = Math.min(1, age * 2.2);             // the pulse runs along it
      const a = e[5] * (1 - age) * 0.95;
      c.strokeStyle = `rgba(${e[4][0]},${e[4][1]},${e[4][2]},${a})`;
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t); c.stroke();
    }

    const glow = (g, arr, col, base, grow) => {
      for (let i = 0; i < arr.length; i++) {
        const v = arr[i];
        if (v <= 0.02) continue;
        alive = true;
        const [x, y] = this.P(g, i);
        c.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${Math.min(1, 0.2 + v)})`;
        const r = (base + grow * v) * zoom;
        c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill();
      }
    };
    glow(G.pn, this.gPn, COL.pn, 0.8, 1.6);
    glow(G.kc, this.gKc, COL.kc, 0.7, 1.4);
    glow(G.pam, this.gDan.subarray(0, this.nPam), COL.pam, 1.0, 2.6);
    glow(G.ppl1, this.gDan.subarray(this.nPam), COL.ppl1, 1.4, 3.4);
    for (let j = 0; j < this.nMb; j++) {
      const v = this.gMb[j];
      if (v <= 0.02) continue;
      alive = true;
      const [x, y] = this.P(G.mbon, j), col = this.B.sign[j] > 0 ? COL.app : COL.avo;
      c.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${Math.min(1, 0.25 + v * 0.75)})`;
      c.beginPath(); c.arc(x, y, (1.6 + 3.2 * v) * zoom, 0, 6.283); c.fill();
    }
    if (this.gApl > 0.03) {
      alive = true;
      for (let i = 0; i < this.A.count[G.apl]; i++) {
        const [x, y] = this.P(G.apl, i);
        c.strokeStyle = `rgba(${COL.apl[0]},${COL.apl[1]},${COL.apl[2]},${this.gApl * 0.7})`;
        c.lineWidth = 1.2;
        c.beginPath(); c.arc(x, y, (3 + 6 * (1 - this.gApl)) * zoom, 0, 6.283); c.stroke();
      }
    }
    return alive;
  }
}

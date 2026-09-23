/* Plates: generative figures in the style of a printed scientific plate.

   Any <canvas data-plate="some-seed"> on a page that loads this script gets a
   drawing. The same seed always gives the same drawing, so a project keeps its
   picture across visits.

     data-plate   seed text, usually the project's slug          (required)
     data-kind    connectome | calyx | raster | lattice          (default connectome)
     data-tone    paper | dark                                   (default paper)
     data-label   a figure letter drawn in the corner, e.g. "A"  (optional)
     data-live    present = let a signal travel the highlighted path

   It can also be called directly:  import { drawPlate } from "/js/plate.js"  */

const TONES = {
  paper: { bg: null, ink: [32, 43, 51], accent: "#8a5a2b", accent2: "#3f8f84", label: "#5b636b" },
  dark:  { bg: "#15181c", ink: [233, 228, 216], accent: "#e39a4f", accent2: "#6fc7b8", label: "#8b8f94" },
};

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let a = hash(seed);
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ink = (t, a) => `rgba(${t.ink[0]},${t.ink[1]},${t.ink[2]},${a})`;
const gauss = r => { let u = 0, v = 0; while (!u) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v); };

/* ----------------------------------------------------------------- kinds -- */

// A bilateral brain outline filled with somata, wired to near neighbours,
// with one pathway traced across it in the accent colour.
function connectome(c, w, h, r, t) {
  const n = Math.round(Math.min(230, 90 + w * h / 1500));
  const cx = w / 2, cy = h / 2, rx = w * 0.42, ry = h * 0.38;
  const pts = [];
  while (pts.length < n) {
    const x = (r() * 2 - 1), y = (r() * 2 - 1);
    // two lobes: a pinched ellipse, narrower at the midline
    const pinch = 0.72 + 0.28 * Math.abs(x);
    if (x * x + (y / pinch) * (y / pinch) > 1) continue;
    pts.push({ x: cx + x * rx, y: cy + y * ry, s: 0.8 + r() * r() * 2.6 });
  }
  c.lineWidth = 0.6;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const near = pts.map((q, j) => [j, (q.x - p.x) ** 2 + (q.y - p.y) ** 2])
      .sort((a, b) => a[1] - b[1]).slice(1, 1 + 1 + Math.floor(r() * 3));
    for (const [j] of near) {
      const q = pts[j], mx = (p.x + q.x) / 2 + gauss(r) * 8, my = (p.y + q.y) / 2 + gauss(r) * 8;
      c.strokeStyle = ink(t, 0.08 + r() * 0.1);
      c.beginPath(); c.moveTo(p.x, p.y); c.quadraticCurveTo(mx, my, q.x, q.y); c.stroke();
    }
  }
  for (const p of pts) {
    c.fillStyle = ink(t, 0.35 + p.s * 0.12);
    c.beginPath(); c.arc(p.x, p.y, p.s, 0, 6.2832); c.fill();
  }
  // the traced pathway: left edge to right edge, always stepping rightwards
  const path = [pts.reduce((a, b) => (b.x < a.x ? b : a))];
  while (path.length < 9) {
    const last = path.at(-1);
    const next = pts.filter(q => q.x > last.x + rx * 0.08 && q.x < last.x + rx * 0.45)
      .map(q => [q, Math.abs(q.y - last.y) + r() * 40]).sort((a, b) => a[1] - b[1])[0];
    if (!next) break;
    path.push(next[0]);
  }
  return path;
}

// A mushroom body: a cup of Kenyon cells, a bundle of parallel fibres, and a
// handful of output neurons where the lobes end.
function calyx(c, w, h, r, t) {
  const cupX = w * 0.27, cupY = h * 0.34, cupR = Math.min(w, h) * 0.21;
  const kcs = [];
  for (let i = 0; i < 560; i++) {
    const a = r() * 6.2832, d = Math.sqrt(r()) * cupR;
    kcs.push({ x: cupX + Math.cos(a) * d * 1.2, y: cupY + Math.sin(a) * d * 0.85 });
  }
  const knee = { x: w * 0.44, y: h * 0.66 }, stalkEnd = { x: w * 0.6, y: h * 0.72 };
  const vTop = h * 0.16, hEnd = w * 0.9;
  const fibre = (k, off, vertical) => {
    c.beginPath(); c.moveTo(k.x, k.y);
    c.bezierCurveTo(k.x + 20, k.y + 60, knee.x - 30 + off, knee.y + off, stalkEnd.x + off, stalkEnd.y + off);
    if (vertical) c.lineTo(stalkEnd.x + off, vTop + off); else c.lineTo(hEnd, stalkEnd.y + off * 1.3);
    c.stroke();
  };
  c.lineWidth = 0.5;
  for (let i = 0; i < 90; i++) {
    c.strokeStyle = ink(t, 0.05 + r() * 0.08);
    fibre(kcs[Math.floor(r() * kcs.length)], gauss(r) * 4, r() < 0.5);
  }
  for (const k of kcs) { c.fillStyle = ink(t, 0.3); c.fillRect(k.x, k.y, 1.3, 1.3); }
  // output neurons along both lobes
  const outs = [];
  for (let i = 0; i < 3; i++) outs.push({ x: stalkEnd.x + 11, y: vTop + 14 + i * (stalkEnd.y - vTop - 40) / 2.6, s: 3 + r() * 2.5 });
  for (let i = 0; i < 4; i++) outs.push({ x: stalkEnd.x + 40 + i * (hEnd - stalkEnd.x - 50) / 3.2, y: stalkEnd.y + 12, s: 3 + r() * 2.5 });
  c.lineWidth = 1;
  for (const o of outs) { c.strokeStyle = ink(t, 0.6); c.beginPath(); c.arc(o.x, o.y, o.s, 0, 6.2832); c.stroke(); }
  // one active Kenyon cell, down the peduncle, to the output it drives
  const k = kcs.reduce((a, b) => (b.y > a.y && r() < 0.5 ? b : a));
  const target = outs[3 + Math.floor(r() * 4)];
  return [k, { x: knee.x - 30, y: knee.y - 10 }, knee, stalkEnd, target];
}

// A spike raster: one row per neuron, one tick per spike, with a moment where
// the population fires together. A rate line runs across the top.
function raster(c, w, h, r, t) {
  const rows = Math.max(18, Math.round(h / 7)), top = h * 0.22, rh = (h * 0.72) / rows;
  const burst = w * (0.35 + r() * 0.35), rate = new Float32Array(Math.ceil(w / 4));
  c.lineWidth = 1;
  for (let i = 0; i < rows; i++) {
    const y = top + i * rh, base = 0.004 + r() * 0.012;
    for (let x = 0; x < w; x += 1.5) {
      const near = Math.exp(-(((x - burst) / (w * 0.035)) ** 2));
      if (r() < base + near * 0.18) {
        c.strokeStyle = near > 0.3 ? t.accent : ink(t, 0.55);
        c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + rh * 0.7); c.stroke();
        rate[Math.floor(x / 4)]++;
      }
    }
  }
  c.strokeStyle = t.accent; c.lineWidth = 1.4; c.beginPath();
  let mx = 1; rate.forEach(v => (mx = Math.max(mx, v)));
  for (let i = 0; i < rate.length; i++) {
    const s = (rate[i - 1] || rate[i]) + rate[i] * 2 + (rate[i + 1] || rate[i]);
    const y = top - 6 - (s / 4 / mx) * h * 0.14;
    i ? c.lineTo(i * 4, y) : c.moveTo(0, y);
  }
  c.stroke();
  return null;
}

// A board-like lattice with a few weighted edges drawn over it. Useful for
// anything grid-shaped: games, tests, schedules.
function lattice(c, w, h, r, t) {
  const n = 8, s = Math.min(w, h) * 0.8 / n, ox = (w - s * n) / 2, oy = (h - s * n) / 2;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if ((i + j) % 2) { c.fillStyle = ink(t, 0.06); c.fillRect(ox + i * s, oy + j * s, s, s); }
  }
  c.strokeStyle = ink(t, 0.25); c.lineWidth = 0.8; c.strokeRect(ox, oy, s * n, s * n);
  const node = () => ({ x: ox + (Math.floor(r() * n) + 0.5) * s, y: oy + (Math.floor(r() * n) + 0.5) * s });
  const nodes = Array.from({ length: 14 }, node);
  c.lineWidth = 0.7;
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    if (r() > 0.18) continue;
    c.strokeStyle = ink(t, 0.18);
    c.beginPath(); c.moveTo(nodes[i].x, nodes[i].y); c.lineTo(nodes[j].x, nodes[j].y); c.stroke();
  }
  for (const p of nodes) { c.fillStyle = ink(t, 0.6); c.beginPath(); c.arc(p.x, p.y, 2.2, 0, 6.2832); c.fill(); }
  return nodes.slice(0, 5).sort((a, b) => a.x - b.x);
}

const KINDS = { connectome, calyx, raster, lattice };

/* --------------------------------------------------------------- drawing -- */

function tracePath(c, path, t, upto = 1) {
  if (!path || path.length < 2) return;
  c.strokeStyle = t.accent; c.lineWidth = 1.6; c.lineCap = "round";
  c.beginPath(); c.moveTo(path[0].x, path[0].y);
  const last = Math.max(1, Math.floor((path.length - 1) * upto));
  for (let i = 1; i <= last; i++) {
    const a = path[i - 1], b = path[i];
    c.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - 6, b.x, b.y);
  }
  c.stroke();
  for (let i = 0; i <= last; i++) {
    c.fillStyle = t.accent; c.beginPath(); c.arc(path[i].x, path[i].y, 2.6, 0, 6.2832); c.fill();
  }
}

function furniture(c, w, h, t, label) {
  c.font = "600 11px 'IBM Plex Mono', ui-monospace, Menlo, monospace";
  c.fillStyle = t.label;
  if (label) { c.textBaseline = "top"; c.fillText(label, 10, 9); }
  // scale bar, bottom right, the way a microscope figure has one
  const bw = Math.round(w * 0.08);
  c.strokeStyle = t.label; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(w - 12 - bw, h - 12); c.lineTo(w - 12, h - 12); c.stroke();
}

export function drawPlate(canvas, opts = {}) {
  const seed = opts.seed ?? canvas.dataset.plate ?? "plate";
  const kind = KINDS[opts.kind ?? canvas.dataset.kind] || connectome;
  const t = TONES[opts.tone ?? canvas.dataset.tone] || TONES.paper;
  const label = opts.label ?? canvas.dataset.label;
  const live = (opts.live ?? "live" in canvas.dataset) &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches;

  let frame = 0;
  function render() {
    cancelAnimationFrame(frame);
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = canvas.clientWidth || 400, h = canvas.clientHeight || 260;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const c = canvas.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const base = document.createElement("canvas");
    base.width = canvas.width; base.height = canvas.height;
    const b = base.getContext("2d");
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (t.bg) { b.fillStyle = t.bg; b.fillRect(0, 0, w, h); }
    const path = kind(b, w, h, rng(seed + ":" + (opts.kind ?? canvas.dataset.kind)), t);
    furniture(b, w, h, t, label);

    if (!live || !path) {
      c.drawImage(base, 0, 0, w, h); tracePath(c, path, t);
      return;
    }
    // a signal walking the traced path, then a pause, then again
    const period = 4200, start = performance.now();
    const step = now => {
      const p = ((now - start) % period) / period;
      c.clearRect(0, 0, w, h); c.drawImage(base, 0, 0, w, h);
      tracePath(c, path, t, Math.min(1, p / 0.7));
      if (p < 0.7) {
        const f = p / 0.7 * (path.length - 1), i = Math.floor(f), k = f - i;
        const a = path[i], z = path[Math.min(i + 1, path.length - 1)];
        const x = a.x + (z.x - a.x) * k, y = a.y + (z.y - a.y) * k;
        const g = c.createRadialGradient(x, y, 0, x, y, 12);
        g.addColorStop(0, t.accent); g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g; c.beginPath(); c.arc(x, y, 12, 0, 6.2832); c.fill();
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  }
  render();
  let last = canvas.clientWidth;
  new ResizeObserver(() => { if (canvas.clientWidth !== last) { last = canvas.clientWidth; render(); } })
    .observe(canvas);
}

for (const cv of document.querySelectorAll("canvas[data-plate]")) drawPlate(cv);

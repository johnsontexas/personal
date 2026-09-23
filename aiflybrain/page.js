/* The page around the brain: drawing the neurons, the chat, the charts and the
   "same question at every age" time machine. */
import { FlyBrain } from "/aiflybrain/brain.js";

const $ = id => document.getElementById(id);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const pct = v => Math.round(v * 100) + "%";
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "k" : n;
const esc = s => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const D = "/aiflybrain/data/";

let meta, brain, ageIdx = 0;

// ------------------------------------------------------------- drawing --
const cv = $("brain"), ctx = cv.getContext("2d");
let W, H, ox, oy, sw, sh, dpr, bg, glow, active = [], isActive;

function layout() {
  dpr = Math.min(2, devicePixelRatio || 1);
  W = cv.width = cv.clientWidth * dpr; H = cv.height = cv.clientHeight * dpr;
  const a = meta.aspect;
  if (W * a <= H) { sw = W; sh = W * a; } else { sh = H; sw = H / a; }
  ox = (W - sw) / 2; oy = (H - sh) / 2;
  const off = document.createElement("canvas");
  off.width = W; off.height = H;
  const o = off.getContext("2d");
  o.fillStyle = css("--dot");
  const r = Math.max(1, dpr * 0.8);
  for (let i = 0; i < meta.N; i++) o.fillRect(px(i), py(i), r, r);
  bg = off;
}
const px = i => ox + brain.xy[2 * i] / 4000 * sw;
const py = i => oy + brain.xy[2 * i + 1] / 4000 * sh;

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(bg, 0, 0);
  const cols = [css("--g0"), css("--g1"), css("--g2")];
  const keep = [];
  for (const i of active) {
    const g = glow[i] *= 0.86;
    if (g < 0.04) { isActive[i] = 0; continue; }
    keep.push(i);
    ctx.globalAlpha = Math.min(1, 0.15 + g);
    ctx.fillStyle = cols[brain.group[i]];
    const s = (1 + 2.2 * g) * dpr;
    ctx.fillRect(px(i) - s / 2, py(i) - s / 2, s, s);
  }
  active = keep;
  ctx.globalAlpha = 1;
  requestAnimationFrame(draw);
}

function light(spikes) {
  let total = 0;
  for (let i = 0; i < spikes.length; i++) {
    const c = spikes[i];
    if (!c) continue;
    total += c;
    glow[i] = Math.min(1, 0.4 + 0.3 * c);
    if (!isActive[i]) { isActive[i] = 1; active.push(i); }
  }
  return total;
}

// ---------------------------------------------------------------- chat --
let busy = false;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function addMsg(role, text) {
  const d = document.createElement("div");
  d.className = "msg " + role;
  d.innerHTML = `<i>${role === "you" ? "you" : "fly brain"}</i><span class="txt mono">${esc(text)}</span>`;
  $("msgs").appendChild(d);
  $("msgs").scrollTop = $("msgs").scrollHeight;
  return d.querySelector(".txt");
}

async function ask(text) {
  if (busy || !brain.w) return;
  busy = true; $("send").disabled = true;
  addMsg("you", text);
  const out = addMsg("fly", "");
  out.parentElement.classList.add("live");
  for (const ev of brain.converse(text, { temperature: +$("temp").value })) {
    const n = light(ev.spikes);
    $("spk").textContent = n.toLocaleString();
    $("now").textContent = ev.ch === " " ? "␣" : ev.ch;
    $("now").className = "now " + ev.role;
    $("nowlab").textContent = ev.role === "you" ? "smelling your letter" : "saying";
    if (ev.role === "fly") {
      out.textContent += ev.ch;
      $("guess").innerHTML = ev.top.map(([c, p]) =>
        `<div class="row"><span class="mono">${c === " " ? "␣" : esc(c)}</span>
         <div class="t"><i style="width:${p * 100}%"></i></div><span>${Math.round(p * 100)}%</span></div>`).join("");
      $("msgs").scrollTop = $("msgs").scrollHeight;
    }
    await sleep(1000 / +$("speed").value);
  }
  out.parentElement.classList.remove("live");
  $("nowlab").textContent = "idle"; $("now").textContent = "";
  busy = false; $("send").disabled = false;
}

// -------------------------------------------------------------- charts --
function line(cv, series, opts) {
  const d = Math.min(2, devicePixelRatio || 1);
  cv.width = cv.clientWidth * d; cv.height = cv.clientHeight * d;
  const x = cv.getContext("2d"), padL = 40 * d, padB = 18 * d, padT = 8 * d;
  const Wc = cv.width - padL - 8 * d, Hc = cv.height - padB - padT;
  const xmax = Math.max(1, ...series.flatMap(s => s.pts.map(p => p[0])));
  const X = v => padL + v / xmax * Wc, Y = v => padT + Hc * (1 - (v - opts.ymin) / (opts.ymax - opts.ymin));
  x.font = `${10 * d}px ui-sans-serif`; x.lineWidth = d;
  for (const t of opts.ticks) {
    x.strokeStyle = css("--line"); x.beginPath(); x.moveTo(padL, Y(t)); x.lineTo(padL + Wc, Y(t)); x.stroke();
    x.fillStyle = css("--dim"); x.fillText(opts.fmtY(t), 2 * d, Y(t) + 3.5 * d);
  }
  x.fillStyle = css("--dim");
  x.fillText(fmt(xmax) + " characters read", padL + Wc - 100 * d, cv.height - 4 * d);
  for (const s of series) {
    if (s.pts.length < 2) continue;
    x.strokeStyle = s.color; x.lineWidth = 2 * d; x.beginPath();
    s.pts.forEach((p, i) => i ? x.lineTo(X(p[0]), Y(p[1])) : x.moveTo(X(p[0]), Y(p[1])));
    x.stroke();
  }
}

function charts() {
  const h = meta.history.filter(p => p.loss !== null);
  line($("loss"), [{ pts: h.map(p => [p.chars_seen, p.loss]), color: css("--accent") }],
    { ymin: 1.6, ymax: 3.9, ticks: [3.71, 3, 2.5, 2], fmtY: v => v.toFixed(2) });
  const tasks = Object.keys(meta.ages.at(-1).eval);
  const cols = ["--g0", "--g1", "--g2", "--c3", "--c4", "--c5", "--c6"];
  line($("curve"), tasks.map((k, i) => ({
    pts: meta.history.map(p => [p.chars_seen, p.eval[k] ? p.eval[k].char_acc : 0]), color: css(cols[i % 7])
  })), { ymin: 0, ymax: 1, ticks: [0, .25, .5, .75, 1], fmtY: pct });
  $("legend").innerHTML = tasks.map((k, i) => `<span><i style="background:${css(cols[i % 7])}"></i>${k}</span>`).join("");
}

function taskTable() {
  const ev = meta.ages[ageIdx].eval;
  $("tasks").innerHTML = Object.entries(ev).map(([k, v]) => `<tr><td>${k}</td>
    <td class="mono ex">${esc(meta.tasks[k] || "")}</td>
    <td class="num"><i class="bar"><b style="width:${v.char_acc * 100}%"></b></i>${pct(v.char_acc)}</td>
    <td class="num"><i class="bar"><b style="width:${v.whole_answer * 100}%"></b></i>${pct(v.whole_answer)}</td>
    <td class="num dim"><i class="bar base"><b style="width:${v.bigram_char_acc * 100}%"></b></i>${pct(v.bigram_char_acc)}</td></tr>`).join("");
}

function timeMachine(i) {
  const h = meta.history[i];
  $("tmlab").textContent = `${fmt(h.chars_seen)} characters read · ${h.minutes} min trained` +
    (h.loss ? ` · error ${h.loss.toFixed(2)}` : "");
  $("probes").innerHTML = Object.entries(h.probes || {}).map(([q, a]) =>
    `<div><span class="q">${esc(q)}</span><b>${esc(a).replace(/ /g, "␣")}</b></div>`).join("");
}

// ---------------------------------------------------------------- boot --
(async () => {
  meta = await (await fetch(D + "meta.json")).json();
  const wiring = await (await fetch(D + "wiring.bin")).arrayBuffer();
  brain = new FlyBrain(meta, wiring);
  glow = new Float32Array(meta.N); isActive = new Uint8Array(meta.N);

  $("nN").textContent = meta.N.toLocaleString();
  $("nE").textContent = meta.E.toLocaleString();
  $("nS").textContent = (meta.n_syn / 1e6).toFixed(1) + " million";
  $("age").innerHTML = meta.ages.map((a, i) =>
    `<option value="${i}">${fmt(a.chars_seen)} chars · ${a.minutes} min</option>`).join("");
  $("age").value = ageIdx = meta.ages.length - 1;

  const loadAge = async i => {
    ageIdx = +i;
    $("sub").textContent = "loading brain age…";
    brain.setAge(await (await fetch(D + meta.ages[ageIdx].file)).arrayBuffer());
    const a = meta.ages[ageIdx];
    $("sub").innerHTML = `${meta.N.toLocaleString()} neurons · ${meta.E.toLocaleString()} real connections · ` +
      `this brain has read ${fmt(a.chars_seen)} characters in ${a.minutes} minutes of training`;
    taskTable();
  };
  await loadAge(ageIdx);
  $("age").onchange = e => loadAge(e.target.value);

  layout(); requestAnimationFrame(draw);
  addEventListener("resize", () => { layout(); charts(); });

  const chips = ["say moon.", "is 8 more than 3?", "4+3=", "count to 5.",
    "if it rains then the grass is wet. it rains. so", "all cats are animals. tom is a cat. so tom is"];
  $("chips").innerHTML = chips.map(c => `<button type="button">${esc(c)}</button>`).join("");
  $("chips").onclick = e => { if (e.target.tagName === "BUTTON") ask(e.target.textContent); };
  $("form").onsubmit = e => { e.preventDefault(); const v = $("inp").value; $("inp").value = ""; ask(v); };

  charts();
  $("growNote").textContent = `Every checkpoint of this brain's life, ${meta.history.length} in all. ` +
    `It starts knowing nothing: no letters, no words, no idea that a question wants an answer.`;
  $("scrub").max = meta.history.length - 1;
  $("scrub").value = meta.history.length - 1;
  $("scrub").oninput = e => timeMachine(+e.target.value);
  timeMachine(meta.history.length - 1);

  addMsg("fly", "ask me something");
})();

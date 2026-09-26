/* The fly's mushroom body, in the browser.
 *
 * A direct port of mbchess/encode.py and MushroomBodyBrain.evaluate/reinforce.
 * Every constant and every offset here mirrors the Python; if one drifts the
 * learned weights stop meaning anything, so verify.py checks the two encoders
 * agree on random positions before shipping.
 */
export const N_PN = 685, N_RES = 69, MAX_HZ = 80.0;
export const O_MAT = 0, O_BLOCK = 12, O_FILE = 204, O_RANK = 300,
             O_ATK = 396, O_KING = 428, O_FLAG = 460, O_TERM = 472,
             O_THREAT = 520, O_RES = 616;
const THREAT_LEVELS = [1, 2, 3, 5, 7, 9];
const PV = [1, 3, 3, 5, 9, 100];            // what a capture costs; king never
const PIECE_MAX = [8, 2, 2, 2, 1, 1];
const VAL = [1, 3, 3, 5, 9, 0];
const TYPES = ['p', 'n', 'b', 'r', 'q', 'k'];

const BLOCK = new Int32Array(64);
for (let sq = 0; sq < 64; sq++) BLOCK[sq] = ((sq >> 3) >> 1) * 4 + ((sq & 7) >> 1);

/* ---- attack generation, matching python-chess board.attacks(sq) ---------
 * The attack set of the piece standing on sq given the occupancy: sliding
 * pieces stop at the first occupied square but that square is included. */
const KNIGHT = [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]];
const KING = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
const BISHOP = [[1,1],[1,-1],[-1,1],[-1,-1]];
const ROOK = [[1,0],[-1,0],[0,1],[0,-1]];

function attacksFrom(sq, type, color, occ, out) {
  const f = sq & 7, r = sq >> 3;
  let n = 0;
  if (type === 0) {                       // pawn
    const dr = color === 0 ? 1 : -1;
    for (const df of [-1, 1]) {
      const nf = f + df, nr = r + dr;
      if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) out[n++] = nr * 8 + nf;
    }
    return n;
  }
  const step = (type === 1) ? KNIGHT : (type === 5) ? KING : null;
  if (step) {
    for (const [df, dr] of step) {
      const nf = f + df, nr = r + dr;
      if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) out[n++] = nr * 8 + nf;
    }
    return n;
  }
  const dirs = type === 2 ? BISHOP : type === 3 ? ROOK : BISHOP.concat(ROOK);
  for (const [df, dr] of dirs) {
    let nf = f + df, nr = r + dr;
    while (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
      const t = nr * 8 + nf;
      out[n++] = t;
      if (occ[t]) break;
      nf += df; nr += dr;
    }
  }
  return n;
}

/* ---- the canonical board ------------------------------------------------
 * Always seen from the fly's side: when it plays Black the position is
 * mirrored (square ^ 56) and the colours swapped, exactly as
 * python-chess board.mirror() does, so one memory serves both colours. */
export function canonical(game, flyIsWhite) {
  const piece = new Array(64).fill(null);
  const rows = game.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = rows[r][f];
      if (!p) continue;
      let sq = (7 - r) * 8 + f;
      let c = p.color === 'w' ? 0 : 1;
      if (!flyIsWhite) { sq ^= 56; c ^= 1; }
      piece[sq] = { t: TYPES.indexOf(p.type), c };
    }
  }
  const fen = game.fen().split(' ');
  let turn = fen[1] === 'w' ? 0 : 1;
  let cast = fen[2];
  let wk = cast.includes('K'), wq = cast.includes('Q'),
      bk = cast.includes('k'), bq = cast.includes('q');
  if (!flyIsWhite) {
    turn ^= 1;
    [wk, wq, bk, bq] = [bk, bq, wk, wq];
  }
  return {
    piece, turn, wk, wq, bk, bq,
    ep: fen[3] !== '-',
    halfmove: +fen[4] || 0,
    fullmove: +fen[5] || 1,
    check: game.in_check(),
    hasMove: game.moves().length > 0,
  };
}

/* ---- encoder (mbchess/encode.py) ---------------------------------------- */
export function encode(cb, B) {
  const x = new Float64Array(N_PN);
  const res = new Float64Array(N_RES);
  const counts = new Float64Array(12);
  const occ = new Uint8Array(64);
  for (let sq = 0; sq < 64; sq++) if (cb.piece[sq]) occ[sq] = 1;

  for (let sq = 0; sq < 64; sq++) {
    const p = cb.piece[sq];
    if (!p) continue;
    const ch = p.c * 6 + p.t;
    counts[ch]++;
    x[O_BLOCK + ch * 16 + BLOCK[sq]] += 1;
    x[O_FILE + ch * 8 + (sq & 7)] += 1;
    x[O_RANK + ch * 8 + (sq >> 3)] += 1;
    const lo = B.resPtr[ch * 64 + sq], hi = B.resPtr[ch * 64 + sq + 1];
    for (let k = lo; k < hi; k++) res[B.resCh[k]] += B.resSgn[k];
    if (p.t === 5) x[O_KING + p.c * 16 + BLOCK[sq]] = 1;
  }
  for (let ch = 0; ch < 12; ch++) x[O_MAT + ch] = counts[ch] / PIECE_MAX[ch % 6];

  const buf = new Int32Array(28);
  const reach = [0, 0];
  // cheapest attacker of each square, per side (Infinity = unattacked)
  const cheap = new Float64Array(128).fill(Infinity);
  for (let c = 0; c < 2; c++) {
    const acc = new Float64Array(16);
    let tot = 0;
    for (let sq = 0; sq < 64; sq++) {
      const p = cb.piece[sq];
      if (!p || p.c !== c) continue;
      const n = attacksFrom(sq, p.t, c, occ, buf);
      for (let i = 0; i < n; i++) {
        acc[BLOCK[buf[i]]] += 1; tot += 1;
        if (PV[p.t] < cheap[c * 64 + buf[i]]) cheap[c * 64 + buf[i]] = PV[p.t];
      }
    }
    reach[c] = tot;
    for (let b = 0; b < 16; b++) x[O_ATK + c * 16 + b] = Math.min(acc[b] * 0.25, 1.5);
  }

  for (let i = O_BLOCK; i < O_FLAG; i++) x[i] = Math.min(x[i], 2.0) * 0.5;

  const f = O_FLAG;
  x[f + 0] = cb.check ? 1 : 0;
  x[f + 1] = cb.wk ? 1 : 0;
  x[f + 2] = cb.wq ? 1 : 0;
  x[f + 3] = cb.bk ? 1 : 0;
  x[f + 4] = cb.bq ? 1 : 0;
  x[f + 5] = cb.ep ? 1 : 0;
  x[f + 6] = Math.min(cb.fullmove / 60.0, 1.5);
  x[f + 7] = cb.hasMove ? 1 : 0;
  let bal = 0;
  for (let t = 0; t < 6; t++) bal += (counts[t] - counts[6 + t]) * VAL[t];
  x[f + 8] = Math.tanh(bal / 10.0) * 0.5 + 0.5;
  x[f + 9] = cb.turn === 0 ? 1 : 0;
  x[f + 10] = Math.min(cb.halfmove / 50.0, 1.0);
  x[f + 11] = Math.min(reach[0] / 40.0, 1.5);

  // the labelled line for the end of the game (see encode.py)
  if (!cb.hasMove) {
    if (cb.check) for (let i = 0; i < 24; i++) x[O_TERM + i] = 1;
    else for (let i = 0; i < 12; i++) x[O_TERM + 24 + i] = 1;
  } else if (cb.check) {
    for (let i = 0; i < 12; i++) x[O_TERM + 36 + i] = 1;
  }
  // the labelled line for danger (see encode.py): pieces standing en prise
  for (let c = 0; c < 2; c++) {
    const o = O_THREAT + c * 48, foe = 1 - c;
    let worst = 0;
    for (let sq = 0; sq < 64; sq++) {
      const p = cb.piece[sq];
      if (!p || p.c !== c || p.t === 5) continue;
      const a = cheap[foe * 64 + sq];
      if (a === Infinity) continue;
      const v = PV[p.t];
      let loss;
      if (cheap[c * 64 + sq] === Infinity) loss = v;
      else if (a < v) loss = v - a;
      else continue;
      for (let i = 0; i < 6; i++) x[o + p.t * 6 + i] = 1;
      if (loss > worst) worst = loss;
    }
    for (let i = 0; i < 6; i++)
      if (worst >= THREAT_LEVELS[i]) for (let j = 0; j < 3; j++) x[o + 30 + i * 3 + j] = 1;
  }
  for (let i = 0; i < N_RES; i++) x[O_RES + i] = 1 / (1 + Math.exp(-res[i]));

  for (let i = 0; i < N_PN; i++) x[i] *= MAX_HZ;
  return x;
}

/* ---- the brain (mbchess/brain.py) --------------------------------------- */
const W_FLOOR = 0.05, W_CEIL = 3.0, GAMMA = 0.97, LAMBDA = 0.7, ADAPT = 1e-4, LR = 0.1, MAX_STEP = 1.0;
export const WIN_DOPAMINE = 6.0;

export class Brain {
  constructor(B) {
    this.B = B;
    this.zMean = B.zMean;
    this.norm = B.norm;
    this.zVar = (B.norm / 3) ** 2;
    this.kcBuf = new Float64Array(B.nKc);
    this.trace = new Float64Array(B.kmW.length);
    this.mbon = new Float64Array(B.nMbon);
    this.last = null;
    this.dopamine = 0;
    this.lr = LR;
  }

  evaluate(pn, keep) {
    const B = this.B, kc = this.kcBuf, n = B.nKc;
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let k = B.pkPtr[i]; k < B.pkPtr[i + 1]; k++) s += B.pkW[k] * pn[B.pkPre[k]];
      kc[i] = s;
    }
    // APL: only the most strongly driven few percent survive
    const k = B.nActive, thresh = kthLargest(kc, k);
    const active = new Int32Array(k), act = new Float64Array(k);
    let m = 0;
    for (let i = 0; i < n && m < k; i++) if (kc[i] > thresh) active[m++] = i;
    for (let i = 0; i < n && m < k; i++) if (kc[i] === thresh) active[m++] = i;
    let sum = 0;
    for (let q = 0; q < k; q++) { act[q] = kc[active[q]] - thresh; sum += act[q]; }
    if (sum > 0) for (let q = 0; q < k; q++) act[q] *= k / sum;

    this.mbon.fill(0);
    let z = 0;
    for (let q = 0; q < k; q++) {
      const i = active[q], a = act[q];
      for (let e = B.kmPtr[i]; e < B.kmPtr[i + 1]; e++) {
        const mb = B.kmPost[e], c = B.kmW[e] * a;
        this.mbon[mb] += c;
        z += c * B.sign[mb];
      }
    }
    const d = z - this.zMean;
    this.zMean += ADAPT * d;
    this.zVar += ADAPT * (d * d - this.zVar);
    this.norm = Math.max(3 * Math.sqrt(Math.max(this.zVar, 1e-12)), 1e-6);
    const v = Math.tanh((z - this.zMean) / this.norm);
    if (keep) this.last = { active, act, v, mbon: Float64Array.from(this.mbon) };
    return v;
  }

  startGame() { this.trace.fill(0); this.last = null; this.dopamine = 0; }

  reinforce(reward, nextValue, terminal, gain) {
    if (!this.last) return 0;
    const B = this.B, { active, act, v } = this.last;
    const dv = (1 - v * v) / this.norm;
    let g2 = 0;                               // |d valence / d weights|^2
    for (let q = 0; q < active.length; q++) {
      const i = active[q], a = act[q] * dv;
      g2 += a * a * (B.kmPtr[i + 1] - B.kmPtr[i]);
      for (let e = B.kmPtr[i]; e < B.kmPtr[i + 1]; e++)
        this.trace[e] += a * B.sign[B.kmPost[e]];
    }
    const target = reward + (terminal ? 0 : GAMMA * nextValue);
    const delta = target - v;
    this.dopamine = delta;
    // normalised (see brain.py): one event moves this position's valence by
    // about lr * delta, however large the MBONs' summed output has grown; a
    // win's flood is capped at correcting all of the error, never more
    const step = Math.min(this.lr * (gain || 1), MAX_STEP) * delta / Math.max(g2, 1e-12);
    const decay = GAMMA * LAMBDA;
    for (let e = 0; e < this.trace.length; e++) {
      const t = this.trace[e];
      if (t === 0) continue;
      let w = B.kmW[e] + step * t;
      const lo = B.kmA[e] * W_FLOOR, hi = B.kmA[e] * W_CEIL;
      B.kmW[e] = w < lo ? lo : w > hi ? hi : w;
      this.trace[e] = t * decay;
    }
    return delta;
  }

  learnedFraction() {
    const B = this.B;
    let a = 0, b = 0;
    for (let e = 0; e < B.kmW.length; e++) { a += Math.abs(B.kmW[e] - B.kmW0[e]); b += Math.abs(B.kmW0[e]); }
    return a / Math.max(b, 1e-9);
  }
}

/* k-th largest, Hoare selection on a scratch copy */
function kthLargest(arr, k) {
  const a = Float64Array.from(arr);
  let lo = 0, hi = a.length - 1, target = a.length - k;
  while (lo < hi) {
    const p = a[(lo + hi) >> 1];
    let i = lo, j = hi;
    while (i <= j) {
      while (a[i] < p) i++;
      while (a[j] > p) j--;
      if (i <= j) { const t = a[i]; a[i] = a[j]; a[j] = t; i++; j--; }
    }
    if (target <= j) hi = j; else if (target >= i) lo = i; else break;
  }
  return a[target];
}

/* ---- load fly.bin ------------------------------------------------------- */
export async function loadBrain(url) {
  return parseBrain(await (await fetch(url)).arrayBuffer());
}

/* Decode fly.bin. Split out from loadBrain so the same code serves the
   standalone page (which fetches the file) and the published artifact
   (which carries it inline, because that sandbox blocks fetch). */
export function parseBrain(buf) {
  const dv = new DataView(buf);
  const magic = new TextDecoder().decode(new Uint8Array(buf, 0, 8));
  if (magic !== 'FLYCHESS') throw new Error('not a fly brain: ' + magic);
  let o = 8;
  const gi = () => { const v = dv.getInt32(o, true); o += 4; return v; };
  const version = gi();
  const nPn = gi(), nKc = gi(), nMbon = gi(), nActive = gi(),
        nPk = gi(), nKm = gi(), nRes = gi(), resK = gi();
  const eloRaw = gi();                       // -1 when never measured
  o = 8 + 10 * 4;
  const zMean = dv.getFloat64(o, true); o += 8;
  const norm = dv.getFloat64(o, true); o += 8;

  const take = (Type, n) => { const a = new Type(buf.slice(o, o + n * Type.BYTES_PER_ELEMENT)); o += n * Type.BYTES_PER_ELEMENT; return a; };
  const pkPtr = take(Int32Array, nKc + 1);
  const pkPre = take(Int16Array, nPk);
  const pkW = take(Float32Array, nPk);
  const kmPtr = take(Int32Array, nKc + 1);
  const kmPost = take(Int16Array, nKm);
  const kmW = take(Float32Array, nKm);
  const sign = take(Int8Array, nMbon);
  const kcXY = take(Int16Array, nKc * 2);
  const mbonXY = take(Int16Array, nMbon * 2);
  const resFeat = take(Int16Array, nRes * resK);
  const resSgn = take(Int8Array, nRes * resK);
  const pst = take(Int16Array, 6 * 64);      // the benchmark opponent's tables
  const pval = take(Float32Array, 6);
  // the synapses' anatomical strengths: learning is bounded to 5%..300% of
  // these, as in brain.py. Version 1 files lack them; bound to the shipped
  // weights instead, as before.
  const kmA = version >= 2 ? take(Float32Array, nKm) : Float32Array.from(kmW);

  // invert the residual projection to a per-feature list (CSR over 768 features)
  const cnt = new Int32Array(769);
  for (let i = 0; i < resFeat.length; i++) cnt[resFeat[i] + 1]++;
  for (let i = 0; i < 768; i++) cnt[i + 1] += cnt[i];
  const resPtr = cnt.slice();
  const fill = new Int32Array(768);
  const resCh = new Int32Array(resFeat.length), resSg = new Float64Array(resFeat.length);
  for (let c = 0; c < nRes; c++) {
    for (let j = 0; j < resK; j++) {
      const feat = resFeat[c * resK + j];
      const at = resPtr[feat] + fill[feat]++;
      resCh[at] = c; resSg[at] = resSgn[c * resK + j];
    }
  }
  return {
    nPn, nKc, nMbon, nActive, zMean, norm, elo: eloRaw < 0 ? null : eloRaw,
    pkPtr, pkPre, pkW, kmPtr, kmPost, kmW, kmW0: Float32Array.from(kmW), kmA,
    sign, kcXY, mbonXY, resPtr, resCh, resSgn: resSg, pst, pval,
  };
}


/* ---- the benchmark opponents (mbchess/opponents.py) ---------------------
   Used to measure the fly's rating in the browser. The tables come from
   fly.bin, so this is the same greedy player the Python trainer rates
   against and the numbers mean the same thing. */
const TYPES2 = ['p', 'n', 'b', 'r', 'q', 'k'];

export function evalBoard(game, color, B) {
  if (game.in_checkmate()) return game.turn() === color ? -1e4 : 1e4;
  if (game.game_over()) return 0;
  let s = 0;
  const rows = game.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = rows[r][f];
      if (!p) continue;
      const t = TYPES2.indexOf(p.type);
      const sq = (7 - r) * 8 + f;
      // white reads the table as laid out; black reads it mirrored
      let v = B.pval[t] * 100 + B.pst[t * 64 + (p.color === 'w' ? sq : (sq ^ 56))];
      s += p.color === color ? v : -v;
    }
  }
  return s / 100;
}

export function greedyMove(game, B) {
  const color = game.turn();
  let best = null, bv = -1e9;
  for (const m of game.moves({ verbose: true })) {
    game.move(m);
    const v = evalBoard(game, color, B);
    game.undo();
    if (v > bv) { bv = v; best = m; }
  }
  return best;
}

/* Negamax with alpha-beta, two plies, captures first: opponents.py's
   SearchOpponent, so "search2" means the same player in both places. */
export function searchMove(game, B, depth = 2) {
  const color = game.turn();
  let best = null, bv = -1e9;
  for (const m of ordered(game)) {
    game.move(m);
    const v = -negamax(game, depth - 1, -1e9, 1e9, color === 'w' ? 'b' : 'w', B);
    game.undo();
    if (v > bv) { bv = v; best = m; }
  }
  return best;
}
function ordered(game) {
  const ms = game.moves({ verbose: true });
  return ms.filter(m => m.captured).concat(ms.filter(m => !m.captured));
}
function negamax(game, depth, a, b, color, B) {
  if (depth === 0 || game.game_over()) return evalBoard(game, color, B);
  let best = -1e9;
  for (const m of ordered(game)) {
    game.move(m);
    const v = -negamax(game, depth - 1, -b, -a, color === 'w' ? 'b' : 'w', B);
    game.undo();
    if (v > best) best = v;
    if (best > a) a = best;
    if (a >= b) break;
  }
  return best;
}

export function randomMove(game) {
  const ms = game.moves({ verbose: true });
  return ms.length ? ms[Math.floor(Math.random() * ms.length)] : null;
}

/* ---- rating (mbchess/elo.py) ---- */
export const ANCHOR = { random: 250, greedy: 800, search2: 1250 };

export function gameScore(result, material) {
  if (result > 0) return 1;
  if (result < 0) return 0;
  if (material > 3) return 1;
  if (material < -3) return 0;
  return 0.5;
}

export function estimateElo(results) {
  // maximum likelihood over the same logistic model and grid as elo.py
  const pts = Object.entries(results)
    .filter(([k, v]) => ANCHOR[k] && v.n > 0)
    .map(([k, v]) => [ANCHOR[k], v.score, v.n]);
  if (!pts.length) return null;
  let best = null, bestLL = -Infinity;
  for (let r = -400; r <= 3000; r += 1) {
    let ll = 0;
    for (const [opp, sc, n] of pts) {
      let p = 1 / (1 + Math.pow(10, (opp - r) / 400));
      p = Math.min(Math.max(p, 1e-9), 1 - 1e-9);
      ll += n * (sc * Math.log(p) + (1 - sc) * Math.log(1 - p));
    }
    if (ll > bestLL) { bestLL = ll; best = r; }
  }
  return best;
}

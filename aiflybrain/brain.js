/* The fly brain, running in your browser.

   This is the same spiking brain as mind.py, tick for tick: leaky
   integrate-and-fire neurons on the real FlyWire wiring, with a hard reset
   after each spike and an adaptive threshold. Characters arrive as smells on
   olfactory receptor neurons; the answer is read from descending neurons,
   split into one pool per character.

   Nothing here is a neural-network library. The whole "model" is the loop in
   step(): deliver spikes along real synapses, integrate, fire. */

const HALF_BUF = new ArrayBuffer(4);
const HALF_U = new Uint32Array(HALF_BUF), HALF_F = new Float32Array(HALF_BUF);

/** IEEE half -> float, without assuming Float16Array exists. */
export function half(u16) {
  const out = new Float32Array(u16.length);
  for (let i = 0; i < u16.length; i++) {
    const h = u16[i], e = (h >> 10) & 0x1f, m = h & 0x3ff, sgn = (h >> 15) & 1;
    let f;
    if (e === 0) f = m === 0 ? 0 : (m / 1024) * Math.pow(2, -14);
    else if (e === 31) f = m ? NaN : Infinity;
    else { HALF_U[0] = ((h & 0x8000) << 16) | ((e - 15 + 127) << 23) | (m << 13); f = HALF_F[0]; }
    out[i] = e === 0 || e === 31 ? (sgn ? -f : f) : f;
  }
  return out;
}

const slice = (buf, [off, len, dtype]) => {
  const T = { uint32: Uint32Array, uint16: Uint16Array, uint8: Uint8Array, float32: Float32Array }[dtype];
  return new T(buf.slice(off, off + len * T.BYTES_PER_ELEMENT));
};

export class FlyBrain {
  constructor(meta, wiringBuf) {
    this.meta = meta;
    const o = meta.offsets;
    this.indptr = slice(wiringBuf, o.indptr);
    this.post = slice(wiringBuf, o.post);
    this.rho = slice(wiringBuf, o.rho);
    this.orn = slice(wiringBuf, o.orn);
    this.code = slice(wiringBuf, o.code);          // chars x n_orn, 1 = this ORN smells this character
    this.dn = slice(wiringBuf, o.dn);
    this.dnPool = slice(wiringBuf, o.dn_pool);
    this.xy = slice(wiringBuf, o.xy);
    this.group = slice(wiringBuf, o.group);
    const N = this.N = meta.N;
    this.v = new Float32Array(N);
    this.s = new Float32Array(N);
    this.a = new Float32Array(N);
    this.rec = new Float32Array(N);
    this.inp = new Float32Array(N);
    this.spikeCount = new Uint8Array(N);
    this.said = new Float32Array(meta.alphabet.length);
    this.poolSize = new Float32Array(meta.alphabet.length);
    for (const p of this.dnPool) this.poolSize[p]++;
  }

  /** Load one brain age: synapse strengths and neuron settings. */
  setAge(buf) {
    const E = this.meta.E, N = this.N;
    const u = new Uint16Array(buf);
    this.w = half(u.subarray(0, E));
    this.bias = half(u.subarray(E, E + N));
    this.beta = half(u.subarray(E + N, E + 2 * N));
    this.strength = half(u.subarray(E + 2 * N, E + 3 * N));
  }

  reset() { this.v.fill(0); this.s.fill(0); this.a.fill(0); }

  /** Smell one character for TICKS ticks. Returns the drive for each possible
      next character, and fills spikeCount with who fired. */
  step(charIndex) {
    const { N, indptr, post, w, v, s, a, rho, bias, beta, strength, rec, inp,
            dn, dnPool, said, poolSize, spikeCount } = this;
    const nOrn = this.orn.length, code = this.code, meta = this.meta;
    inp.fill(0); said.fill(0); spikeCount.fill(0);
    const base = charIndex * nOrn;
    for (let i = 0; i < nOrn; i++) if (code[base + i]) inp[this.orn[i]] = meta.in_current;

    for (let t = 0; t < meta.ticks; t++) {
      rec.fill(0);
      for (let i = 0; i < N; i++) {                    // only neurons that spiked send anything
        if (s[i] === 0) continue;
        for (let k = indptr[i], e = indptr[i + 1]; k < e; k++) rec[post[k]] += w[k];
      }
      for (let i = 0; i < N; i++) {
        const th = 1 + strength[i] * a[i];
        let x = beta[i] * v[i] * (1 - s[i]) + rec[i] + inp[i] + bias[i];
        x = x < -3 ? -3 : x > 4 ? 4 : x;
        v[i] = x;
        const sp = x > th ? 1 : 0;
        s[i] = sp;
        a[i] = rho[i] * a[i] + (1 - rho[i]) * sp;
        if (sp) spikeCount[i]++;
      }
      for (let j = 0; j < dn.length; j++) if (s[dn[j]]) said[dnPool[j]]++;
    }
    const logits = new Float32Array(said.length);
    const vsum = new Float32Array(said.length);
    for (let j = 0; j < dn.length; j++) {
      const x = v[dn[j]];
      vsum[dnPool[j]] += x < -2 ? -2 : x > 2 ? 2 : x;
    }
    for (let c = 0; c < logits.length; c++) {
      const n = poolSize[c] || 1;
      logits[c] = meta.out_gain * (said[c] / n) + meta.v_gain * (vsum[c] / n);
    }
    return logits;
  }

  /** Answer a prompt: feed it in, then let the brain keep talking. */
  *converse(text, { temperature = 0.05, maxChars = 90, stopAtPeriod = true } = {}) {
    const A = this.meta.alphabet;
    this.reset();
    let clean = [...text.toLowerCase()].filter(ch => A.includes(ch)).join("").trim() || "say moon.";
    if (!clean.endsWith("=")) clean += " ";
    let logits = null;
    for (const ch of clean) {
      logits = this.step(A.indexOf(ch));
      yield { role: "you", ch, spikes: this.spikeCount, logits };
    }
    for (let k = 0; k < maxChars; k++) {
      const p = softmax(logits, temperature), q = softmax(logits, 0.05);
      const ch = A[sample(p)];
      logits = this.step(A.indexOf(ch));
      yield { role: "fly", ch, spikes: this.spikeCount, logits, top: top5(q, A) };
      if (stopAtPeriod && ch === ".") break;
    }
  }
}

function softmax(z, temp) {
  const t = Math.max(temp, 1e-3), out = new Float32Array(z.length);
  let m = -Infinity, sum = 0;
  for (const x of z) m = Math.max(m, x);
  for (let i = 0; i < z.length; i++) { out[i] = Math.exp((z[i] - m) * (0.05 / t)); sum += out[i]; }
  for (let i = 0; i < out.length; i++) out[i] /= sum;
  return out;
}

function sample(p) {
  let r = Math.random(), i = 0;
  while (i < p.length - 1 && (r -= p[i]) > 0) i++;
  return i;
}

function top5(p, A) {
  return [...p].map((v, i) => [A[i], v]).sort((a, b) => b[1] - a[1]).slice(0, 5);
}

// Seeded random numbers (mulberry32), so a run can be saved, resumed and replayed exactly.
export class Rng {
  constructor(seed) { this.state = seed >>> 0; }
  next() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** Integer in [0, n). */
  int(n) { return Math.floor(this.next() * n); }
  /** Integer in [lo, hi]. */
  range(lo, hi) { return lo + this.int(hi - lo + 1); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[this.int(arr.length)]; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = this.int(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
  /** Picks a key from {key: weight}. */
  weighted(weights) {
    const entries = Object.entries(weights).filter(([, w]) => w > 0);
    let r = this.next() * entries.reduce((s, [, w]) => s + w, 0);
    for (const [k, w] of entries) { if ((r -= w) < 0) return k; }
    return entries[entries.length - 1][0];
  }
}

export const newSeed = () => (Math.random() * 2 ** 32) >>> 0;

// Teaching-size Bloom and Cuckoo filters. Pure logic, no DOM: index.html draws them, selftest.mjs checks them.

export function fnv1a(str, seed = 0x811c9dc5) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// ---------- Bloom ----------
export const BLOOM_M = 32;
export const BLOOM_K = 3;

export function bloomPositions(name, m = BLOOM_M, k = BLOOM_K) {
  // Double hashing; h2 is odd, so with m a power of 2 the k positions are distinct.
  const h1 = fnv1a(name, 0x811c9dc5);
  const h2 = fnv1a(name, 0x9747b28c) | 1;
  const out = [];
  for (let i = 0; i < k; i++) out.push((h1 + i * h2) % m);
  return out;
}

export function createBloom(m = BLOOM_M, k = BLOOM_K) {
  return { m, k, bits: new Array(m).fill(0), added: new Set() };
}

export function bloomAdd(b, name) {
  const pos = bloomPositions(name, b.m, b.k);
  const newlySet = pos.filter(p => !b.bits[p]);
  pos.forEach(p => { b.bits[p] = 1; });
  b.added.add(name);
  return { pos, newlySet };
}

// result: "no" (definitely not) | "maybe"; falsePositive tells the teaching truth.
export function bloomCheck(b, name) {
  const pos = bloomPositions(name, b.m, b.k);
  const zeros = pos.filter(p => !b.bits[p]);
  const result = zeros.length ? 'no' : 'maybe';
  return { pos, zeros, result, falsePositive: result === 'maybe' && !b.added.has(name) };
}

export function bloomFill(b) {
  return b.bits.reduce((s, x) => s + x, 0) / b.m;
}

export function findFalsePositive(b, candidates) {
  return candidates.find(c => !b.added.has(c) && bloomCheck(b, c).result === 'maybe') || null;
}

// ---------- Cuckoo ----------
export const CUCKOO_BUCKETS = 8;
export const CUCKOO_SLOTS = 2;
export const MAX_KICKS = 16;

export function fingerprint(name) {
  return (fnv1a(name, 0x01234567) & 0xff) || 1; // 8-bit, never 0 (0 = empty)
}

export function bucket1(name, n = CUCKOO_BUCKETS) {
  return fnv1a(name, 0x5bd1e995) % n;
}

// Other bucket depends only on (current bucket, fingerprint), so a kicked item can move without its name.
// XOR with 1..n-1 (n is a power of 2) always gives a different bucket, and alt(alt(i)) === i.
export function altBucket(i, fp, n = CUCKOO_BUCKETS) {
  return i ^ ((fnv1a('fp' + fp) % (n - 1)) + 1);
}

export const hex = fp => fp.toString(16).padStart(2, '0');

export function createCuckoo(n = CUCKOO_BUCKETS, slots = CUCKOO_SLOTS, seed = 7) {
  return {
    n, slots, seed,
    // each slot: null or { fp, name } (a real filter stores only fp; the name is a teaching label)
    table: Array.from({ length: n }, () => new Array(slots).fill(null)),
    added: new Set(),
  };
}

function rand(c) { // small LCG so runs are repeatable
  c.seed = (Math.imul(c.seed, 1103515245) + 12345) >>> 0;
  return c.seed >>> 16;
}

function freeSlot(c, i) { return c.table[i].indexOf(null); }

export function cuckooAdd(c, name) {
  const fp = fingerprint(name);
  const i1 = bucket1(name, c.n);
  const i2 = altBucket(i1, fp, c.n);
  const steps = [`"${name}" → fingerprint ${hex(fp)}, buckets ${i1} and ${i2}`];
  for (const i of [i1, i2]) {
    const s = freeSlot(c, i);
    if (s >= 0) {
      c.table[i][s] = { fp, name };
      c.added.add(name);
      steps.push(`Bucket ${i} has a free slot → stored ${hex(fp)} there`);
      return { ok: true, fp, i1, i2, steps, kicks: 0, moved: [] };
    }
  }
  const backup = c.table.map(b => b.slice());
  const seedBefore = c.seed;
  steps.push(`Both buckets full → kick someone out`);
  let cur = { fp, name };
  let i = rand(c) % 2 ? i2 : i1;
  const moved = [];
  for (let k = 1; k <= MAX_KICKS; k++) {
    const s = rand(c) % c.slots;
    const victim = c.table[i][s];
    c.table[i][s] = cur;
    const j = altBucket(i, victim.fp, c.n);
    steps.push(`Kick ${k}: ${hex(cur.fp)} takes bucket ${i}; ${hex(victim.fp)} (${victim.name}) is kicked to its other bucket ${j}`);
    moved.push(victim.name);
    const free = freeSlot(c, j);
    if (free >= 0) {
      c.table[j][free] = victim;
      c.added.add(name);
      steps.push(`Bucket ${j} has a free slot → ${hex(victim.fp)} lands there. Done after ${k} kick${k > 1 ? 's' : ''}.`);
      return { ok: true, fp, i1, i2, steps, kicks: k, moved };
    }
    cur = victim;
    i = j;
  }
  c.table = backup; // undo, so the demo table stays consistent
  c.seed = seedBefore;
  steps.push(`Gave up after ${MAX_KICKS} kicks → table is FULL. Real systems resize or rebuild here.`);
  return { ok: false, fp, i1, i2, steps, kicks: MAX_KICKS, moved: [] };
}

export function cuckooCheck(c, name) {
  const fp = fingerprint(name);
  const i1 = bucket1(name, c.n);
  const i2 = altBucket(i1, fp, c.n);
  const hit = [i1, i2].find(i => c.table[i].some(e => e && e.fp === fp));
  const result = hit === undefined ? 'no' : 'maybe';
  return { fp, i1, i2, result, falsePositive: result === 'maybe' && !c.added.has(name) };
}

export function cuckooDelete(c, name) {
  const fp = fingerprint(name);
  const i1 = bucket1(name, c.n);
  const i2 = altBucket(i1, fp, c.n);
  if (!c.added.has(name)) {
    return { ok: false, fp, i1, i2, reason: 'never-added' };
  }
  for (const i of [i1, i2]) {
    // prefer this exact item; another item with the same fingerprint in the same buckets is interchangeable
    let s = c.table[i].findIndex(e => e && e.name === name);
    if (s < 0) s = c.table[i].findIndex(e => e && e.fp === fp);
    if (s >= 0) {
      c.table[i][s] = null;
      c.added.delete(name);
      return { ok: true, fp, i1, i2, from: i };
    }
  }
  return { ok: false, fp, i1, i2, reason: 'not-found' };
}

export function cuckooCount(c) {
  return c.table.reduce((s, b) => s + b.filter(Boolean).length, 0);
}

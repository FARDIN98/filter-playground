import assert from 'node:assert/strict';
import * as F from './filters.js';
import { validate } from './challenge.js';
import { SCENARIOS } from './scenarios.js';

const names = Array.from({ length: 60 }, (_, i) => `user_${i}`);

// Bloom: distinct positions, never a false negative, FP labelled correctly.
for (const n of names) assert.equal(new Set(F.bloomPositions(n)).size, F.BLOOM_K, `positions distinct for ${n}`);
const b = F.createBloom();
names.slice(0, 10).forEach(n => F.bloomAdd(b, n));
for (const n of names.slice(0, 10)) {
  const r = F.bloomCheck(b, n);
  assert.equal(r.result, 'maybe', `no false negative for ${n}`);
  assert.equal(r.falsePositive, false);
}
const fp = F.findFalsePositive(b, names.slice(10));
assert.ok(fp, 'a false positive exists once 10 of 32 bits-worth are added');
assert.equal(F.bloomCheck(b, fp).falsePositive, true);
assert.equal(F.bloomCheck(F.createBloom(), 'x').result, 'no');

// Cuckoo: alt bucket is symmetric and different.
for (let i = 0; i < F.CUCKOO_BUCKETS; i++) for (let f = 1; f < 256; f++) {
  const j = F.altBucket(i, f);
  assert.notEqual(j, i); assert.ok(j >= 0 && j < F.CUCKOO_BUCKETS);
  assert.equal(F.altBucket(j, f), i);
}

// Insert until full; every stored item must stay findable, including those moved by kicks.
const c = F.createCuckoo();
const stored = [];
let sawKick = false, sawFull = false;
for (const n of names) {
  const before = F.cuckooCount(c);
  const r = F.cuckooAdd(c, n);
  if (r.ok) { stored.push(n); assert.equal(F.cuckooCount(c), before + 1); if (r.kicks) sawKick = true; }
  else { sawFull = true; assert.equal(F.cuckooCount(c), before, 'failed insert is rolled back'); }
  for (const s of stored) assert.equal(F.cuckooCheck(c, s).result, 'maybe', `${s} findable after adding ${n}`);
  // every entry sits in one of its two buckets
  c.table.forEach((bk, i) => bk.forEach(e => { if (e) {
    const i1 = F.bucket1(e.name); assert.ok(i === i1 || i === F.altBucket(i1, e.fp), `${e.name} in a legal bucket`);
  } }));
}
assert.ok(sawKick, 'kick-outs happened'); assert.ok(sawFull, 'table eventually full');

// Delete works and refuses never-added names.
const victim = stored[3];
assert.equal(F.cuckooDelete(c, victim).ok, true);
assert.equal(c.added.has(victim), false);
assert.equal(F.cuckooDelete(c, 'never_added_name').reason, 'never-added');
for (const s of stored.filter(s => s !== victim)) assert.equal(F.cuckooCheck(c, s).result, 'maybe');

// Sizing: textbook case and the video's numbers.
const t = F.bloomSize(1e6, 0.01);
assert.ok(Math.abs(t.bits - 9.585e6) < 1e4 && t.k === 7, 'n=1e6, p=1% → ~9.59M bits, k=7');
const demo = F.bloomSize(3023103, 1e-4);
assert.ok(demo.bytes > 7.0e6 && demo.bytes < 7.5e6 && demo.k === 13, 'video demo ≈ 7.2–7.5 MB, 13 hashes');
assert.ok(Math.abs(F.bloomSize(3e9, 1e-4).bytes / 1e9 - 7.2) < 0.05, '300 crore ≈ 7.2 GB');

// Challenges data is valid.
assert.deepEqual(validate(SCENARIOS), []);

console.log(`selftest ok: bloom fp example "${fp}", cuckoo stored ${stored.length}/${F.CUCKOO_BUCKETS * F.CUCKOO_SLOTS}`);

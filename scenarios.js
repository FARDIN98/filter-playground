// EP-4 scenario challenges, built from the video's decision guide, HLD and gotchas.
const F4 = ['Bloom', 'Counting Bloom', 'Cuckoo', 'Binary Fuse'];

export const SCENARIOS = [
  { tag: 'Pick the filter', q: 'Usernames are only ever <b>added, never deleted</b>. You want the simplest filter.', options: F4, answer: 'Bloom',
    why: 'Only add, never delete → Bloom. Simple, fast, low memory.' },
  { tag: 'Pick the filter', q: 'Blocked IPs get <b>unblocked often</b>, and each machine runs <b>4 workers</b> that should share one copy.', options: F4, answer: 'Cuckoo',
    why: 'Cuckoo supports real-time delete, and in the demo one shared mmap file served all workers and loaded instantly on restart.' },
  { tag: 'Pick the filter', q: 'A list that changes <b>once a year</b> (like valid roll numbers). RAM is tight and you can rebuild when it changes.', options: F4, answer: 'Binary Fuse',
    why: 'Static data + minimum RAM → Binary Fuse, the “static king”. To change it you rebuild it.' },
  { tag: 'Pick the filter', q: 'Your team already runs Bloom everywhere, but now you <b>must delete</b> entries and can spare more memory.', options: F4, answer: 'Counting Bloom',
    why: 'A counter per slot instead of one bit lets you subtract, so delete works. The cost is more memory.' },
  { tag: 'Pick the filter', q: 'You need <b>accurate answers every time, with deletes</b>, for a login check.', options: F4, answer: 'Cuckoo',
    why: 'The video’s recommendation: accurate with deletes → Cuckoo. Fewer false positives than Bloom.' },
  { tag: 'The HLD', q: 'The filter says <b>NO</b> for “ankit_99”. What do you do?', options: ['Check the DB to be sure', 'Reply “not found” (404) right away', 'Ask Redis'], answer: 'Reply “not found” (404) right away',
    why: 'A filter’s NO is a promise: no false negatives. No DB hit needed.' },
  { tag: 'The HLD', q: 'The filter says <b>MAYBE</b> for “priya”. What do you do?', options: ['Reply “taken” right away', 'Confirm in the DB / Elasticsearch', 'Rebuild the filter'], answer: 'Confirm in the DB / Elasticsearch',
    why: 'A YES is only a rumour (false positive possible). The DB confirms: found → 200, not found → 404.' },
  { tag: 'Architect', q: 'A new user signs up on server A. How do servers B, C and D learn about it?', options: ['Rebuild every filter every minute', 'Push the change with Redis Streams', 'Each server asks the DB on every check'], answer: 'Push the change with Redis Streams',
    why: 'Bulk-load from the DB on startup, then Redis Streams pushes every change to all servers in a fraction of a second.' },
  { tag: 'Architect', q: '<b>300 crore</b> usernames. The filter and DB no longer fit on one machine/node.', options: ['Buy one much bigger machine', 'Shard the data', 'Drop the filter'], answer: 'Shard the data',
    why: 'At 300 crore a single machine/node isn’t enough → sharding.' },
  { tag: 'Architect', q: 'A <b>3-person startup</b> with a few thousand users asks: add a Cuckoo filter on day one?', options: ['Yes, from day one', 'Not yet: add it when stats show DB load', 'Use Binary Fuse instead'], answer: 'Not yet: add it when stats show DB load',
    why: 'The video says don’t add these on day one. Add them as users scale, and decide by watching the stats.' },
];

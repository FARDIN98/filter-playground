# Filter playground

Add, check and delete names in a tiny Bloom filter (32 bits, 3 hashes) and Cuckoo filter (8 buckets × 2 slots), and watch the bits and buckets change, including false positives and cuckoo kick-outs.

Live: https://fardin98.github.io/filter-playground/

Companion to EP-4 of Ankit Jain's System Design series: https://www.youtube.com/watch?v=B8hMPCM7i8w

Self-test of the filter logic: `node selftest.mjs`

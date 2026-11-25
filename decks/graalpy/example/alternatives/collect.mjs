// Turns results/*.json (from ./run.sh, 3 cold runs per runtime) and results/isolated-numpy.txt
// into ../../sections/_shared/alternatives.json for chapter 4.   node decks/graalpy/example/alternatives/collect.mjs
import fs from 'node:fs';
import path from 'node:path';

const HERE = import.meta.dirname;
const OUT = path.join(HERE, '..', '..', 'sections', '_shared', 'alternatives.json');
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const round = (x) => Math.round(x * 10) / 10;

const runtimes = {};
for (const rt of ['jython', 'jep', 'graalpy']) {
  const runs = fs.readdirSync(path.join(HERE, 'results')).filter((f) => new RegExp(`^${rt}-\\d+\\.json$`).test(f)).sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(HERE, 'results', f), 'utf8')));
  if (!runs.length) throw new Error(`no results for ${rt}`);
  const first = runs[0];
  const m = (k) => (runs[0][k] === undefined ? null : round(med(runs.map((r) => r[k]))));
  runtimes[rt] = {
    runtime: first.runtime, python: first.python, runs: runs.length,
    fstring: first.fstring, numpy: first.numpy,
    probeSeenByPython: first.probeSeenByPython, probeReturnedToJava: first.probeReturnedToJava, probeElement0InJava: first.probeElement0InJava,
    primes: first.primes,
    startupMs: m('startupMs'), startupAll: runs.map((r) => r.startupMs),
    primesMs: first.primesMs,                                  // 15 calls in one interpreter, run 1
    primesSteadyMs: round(med(runs.flatMap((r) => r.primesMs.slice(-10)))), // median of last 10 calls, all runs
    threads: first.threads, thread1Ms: m('thread1Ms'), threadNMs: m('threadNMs'), threadNote: first.threadNote,
    isolated1Ms: m('isolated1Ms'), isolatedNMs: m('isolatedNMs'),
    jvm: first.jvm ?? null,
  };
}
const isolatedNumpy = fs.readFileSync(path.join(HERE, 'results', 'isolated-numpy.txt'), 'utf8');
const versions = { jython: '2.7.4', jep: '4.4.0', graalpy: '25.0.5', cpython: runtimes.jep.python, jdk: 'Corretto 25.0.1' };
fs.writeFileSync(OUT, JSON.stringify({ versions, machine: 'Apple M1 Pro, macOS', primesN: 200000, threadN: 100000, runtimes, isolatedNumpy }, null, 1) + '\n');
console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
for (const [k, r] of Object.entries(runtimes)) console.log(k, r.python, 'startup', r.startupMs, 'primes', r.primesSteadyMs, 'threads', r.thread1Ms, r.threadNMs, r.isolatedNMs);

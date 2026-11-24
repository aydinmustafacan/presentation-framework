// Turns the real build/run outputs of flask-jar/ into the JSON the deck reads.
//   cd decks/graalpy/example/flask-jar && mvn package && ./bench.sh java openjdk && ./bench.sh <graalvm>/bin/java graalvm2
//   ./startup.sh java openjdk && ./startup.sh <graalvm>/bin/java graalvm   (see README.md for the trace run)
//   node decks/graalpy/example/collect.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HERE = import.meta.dirname;
const P = (...p) => path.join(HERE, 'flask-jar', ...p);
const OUT = path.join(HERE, '..', 'sections', '_shared', 'measured.json');
const anon = (s) => s.split(os.homedir()).join('~');

// ---- JAR anatomy ----
const JAR = P('target', 'flask-jar-1.0.jar');
const listing = execFileSync('zipinfo', ['-l', JAR], { encoding: 'utf8', maxBuffer: 64 << 20 });
const CATS = [
  ['app', 'Your app', 'app.py, wsgi_bridge.py, Main.class', /^(org\.graalvm\.python\.vfs\/src\/|demo\/)/],
  ['pip', 'pip (in the venv)', 'installed into the venv by the plugin; not imported at run time', /^org\.graalvm\.python\.vfs\/venv\/lib\/python3\.12\/site-packages\/pip/],
  ['venv', 'Flask + dependencies', 'flask, werkzeug, jinja2, click, markupsafe, itsdangerous, blinker', /^org\.graalvm\.python\.vfs\//],
  ['stdlib', 'Python standard library', 'META-INF/resources/libpython: extracted to a cache dir on first run', /^META-INF\/resources\/libpython\//],
  ['capi', 'C-API support, headers, patches', 'libgraalpy, include/, NFI native glue', /^META-INF\/resources\/(libgraalpy|include|nfi-native|engine)/],
  ['native', 'Native libraries ×4 platforms', 'linux/amd64, linux/aarch64, darwin/aarch64, windows/amd64', /^META-INF\/resources\/(linux|darwin|windows)\//],
  ['graalpy', 'GraalPy interpreter', 'com.oracle.graal.python: parser, bytecode compiler, interpreter, builtins', /^com\/oracle\/graal\/python\//],
  ['truffle', 'Truffle framework', 'truffle-api, polyglot, regex (TRegex), NFI, runtime', /^com\/oracle\/truffle\//],
  ['shadowed', 'Shaded libraries', 'ICU4J (Unicode), XZ, JLine, JSON — relocated under org.graalvm.shadowed', /^org\/graalvm\/shadowed\//],
  ['polyglot', 'Polyglot API + SDK', 'org.graalvm.polyglot.Context, Value, …', /^org\/graalvm\//],
  ['other', 'Other', 'manifests, multi-release classes, metadata', /./],
];
const jar = Object.fromEntries(CATS.map(([id, label, detail]) => [id, { id, label, detail, files: 0, bytes: 0, compressed: 0 }]));
for (const line of listing.split('\n')) {
  if (!line.startsWith('-')) continue;
  const f = line.trim().split(/\s+/);
  const name = f.slice(9).join(' ');
  const cat = CATS.find((c) => c[3].test(name));
  const e = jar[cat[0]];
  e.files++; e.bytes += +f[3]; e.compressed += +f[5];
}
const jarSize = fs.statSync(JAR).size;
const thinSize = fs.statSync(P('target', 'original-flask-jar-1.0.jar')).size;

// ---- packages in the venv ----
const site = P('target', 'classes', 'org.graalvm.python.vfs', 'venv', 'lib', 'python3.12', 'site-packages');
const du = (d) => { let s = 0; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); s += e.isDirectory() ? du(p) : fs.statSync(p).size; } return s; };
const installed = fs.readFileSync(P('target', 'classes', 'org.graalvm.python.vfs', 'venv', 'installed.txt'), 'utf8')
  .split('\n').filter((l) => l && !l.startsWith('#')).map((l) => { const [name, version] = l.split('=='); return { name, version }; });
const packages = fs.readdirSync(site, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.includes('.dist-info') && !e.name.startsWith('_'))
  .map((e) => {
    const dir = path.join(site, e.name);
    const files = fs.readdirSync(dir);
    return { name: e.name, bytes: du(dir), cSources: files.filter((f) => f.endsWith('.c')), compiled: files.filter((f) => /\.(so|pyd|dylib)$/.test(f)) };
  }).sort((a, b) => b.bytes - a.bytes);
const filesList = fs.readFileSync(P('target', 'classes', 'org.graalvm.python.vfs', 'fileslist.txt'), 'utf8').split('\n').filter(Boolean);
const pyvenv = Object.fromEntries(fs.readFileSync(P('target', 'classes', 'org.graalvm.python.vfs', 'venv', 'pyvenv.cfg'), 'utf8')
  .split('\n').filter(Boolean).map((l) => l.split(' = ')));

// ---- benchmarks ----
const ms = (f) => fs.readFileSync(P(f), 'utf8').trim().split('\n').map((x) => Math.round(+x * 1000));
const cpython = [1, 2, 3].map(() => JSON.parse(execFileSync('python3', [P('primes_cpython.py')], { encoding: 'utf8' })));

// ---- compilation trace (GraalVM JDK, -Dpolyglot.engine.TraceCompilation=true) ----
const trace = [];
let req = 0, ready = false;
for (const line of fs.readFileSync(P('trace-graalvm.log'), 'utf8').split('\n')) {
  if (line === 'MARK-READY') { ready = true; continue; }
  const m = /^MARK-REQ(\d+)/.exec(line);
  if (m) { req = +m[1]; continue; }
  if (!ready || !line.startsWith('[engine]')) continue;
  const ev = /\[engine\] opt (done|deopt|inval\.)\s+engine=\d+\s+id=(\d+)\s+(<[^>]*>(?:<OSR@\d+>)?|\S+)/.exec(line);
  if (!ev) continue;
  const g = (re) => (re.exec(line) || [])[1];
  trace.push({
    kind: ev[1] === 'inval.' ? 'invalidate' : ev[1], id: +ev[2], target: ev[3], afterRequest: req,
    tier: g(/\|Tier (\d)/) ? +g(/\|Tier (\d)/) : null,
    compileMs: g(/\|Time\s+(\d+)/) ? +g(/\|Time\s+(\d+)/) : null,
    codeSize: g(/CodeSize\s+(\d+)/) ? +g(/CodeSize\s+(\d+)/) : null,
    inlined: g(/Inlined\s+(\d+)Y/) ? +g(/Inlined\s+(\d+)Y/) : null,
    src: g(/\|Src ([^|]+?)(?:\s+0x[0-9a-f]+)?(?:\||$)/) ?? null,
    reason: g(/\|Reason (.+)$/) ?? null,
    utc: g(/UTC (\S+?)\|/),
  });
}
const responses = Object.fromEntries(fs.readdirSync(P('responses')).map((f) => [f.replace(/\.\w+$/, ''), anon(fs.readFileSync(P('responses', f), 'utf8'))]));

const data = {
  versions: { graalpy: '25.0.5', python: pyvenv.version, flask: installed.find((p) => p.name === 'Flask').version, jdk: '25.0.1' },
  machine: 'Apple M1 Pro, macOS',
  jar: { size: jarSize, thinSize, files: Object.values(jar).reduce((s, c) => s + c.files, 0), categories: Object.values(jar) },
  venv: { installed, packages, vfsFiles: filesList.length },
  bench: {
    request: 'GET /primes/200000 (pure-Python loops), 40 times in a row, one fresh JVM per run',
    openjdk: { label: 'OpenJDK 25 (Corretto) — fallback runtime, no JIT', ms: ms('bench-openjdk.txt') },
    graalvm: { label: 'GraalVM CE 25 — Truffle JIT enabled', ms: ms('bench-graalvm2.txt') },
    graalvmRun1: { label: 'GraalVM CE 25, another run', ms: ms('bench-graalvm.txt') },
    cpython: { label: `CPython ${cpython[0].python} (host, no Flask/HTTP)`, ms: cpython.map((c) => c.ms[0]) },
  },
  // time from launch to first 200 on GET / (startup.sh); CPython: `import app` only (Flask + app module), no server
  startup: {
    openjdk: ms('startup-openjdk.txt').map((x) => x / 1000),
    graalvm: ms('startup-graalvm.txt').map((x) => x / 1000),
    cpythonImport: ms('startup-cpython.txt').map((x) => x / 1000),
  },
  // latencies of the 6 requests made while recording trace-graalvm.log
  traceRequests: ms('trace-requests.txt'),
  trace,
  responses,
};
fs.writeFileSync(OUT, JSON.stringify(data, null, 1) + '\n');
console.log(`wrote ${path.relative(process.cwd(), OUT)}: jar ${(jarSize / 1e6).toFixed(1)} MB, ${trace.length} trace events, ${packages.length} packages`);

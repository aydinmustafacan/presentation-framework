import { useState, type CSSProperties } from 'react';
import { Slide, Grid, Card, Callout } from '@framework';
import { M, MB, sec, median, steady, sum } from '../_shared/data.ts';
import { Note, Measured } from '../_shared/ui.tsx';
import './style.css';

/** total wall time to start and then serve n /primes requests, from the measurements */
const fromRun = (startup: number, ms: readonly number[]) => (n: number) =>
  startup + sum(ms.slice(0, Math.min(n, ms.length))) + Math.max(0, n - ms.length) * steady(ms);

const RUNTIMES = [
  { id: 'cpython', label: 'CPython', sub: 'loop only, lower bound', tone: 'violet', startup: median(M.startup.cpythonImport), total: (n: number) => median(M.startup.cpythonImport) + n * median(M.bench.cpython.ms) },
  { id: 'openjdk', label: 'JAR on OpenJDK', sub: 'no JIT', tone: 'red', startup: median(M.startup.openjdk), total: fromRun(median(M.startup.openjdk), M.bench.openjdk.ms) },
  { id: 'graalvm', label: 'JAR on GraalVM', sub: 'JIT', tone: 'green', startup: median(M.startup.graalvm), total: fromRun(median(M.startup.graalvm), M.bench.graalvm.ms) },
] as const;

const ROWS: { k: string; cpy: string; jar: string }[] = [
  { k: 'What you ship', cpy: 'source + requirements.txt; target needs a Python', jar: `one ${MB(M.jar.size)} JAR; target needs a JVM` },
  { k: 'Python version on the server', cpy: 'whatever is installed', jar: `GraalPy ${M.versions.graalpy} = Python ${M.versions.python}, inside the JAR` },
  { k: 'Startup to first response', cpy: `${sec(median(M.startup.cpythonImport))} (import app)`, jar: `${sec(median(M.startup.openjdk))} OpenJDK · ${sec(median(M.startup.graalvm))} GraalVM` },
  { k: 'Pure-Python hot loop, warm', cpy: sec(median(M.bench.cpython.ms)), jar: `${sec(steady(M.bench.graalvm.ms))} with JIT · ${sec(steady(M.bench.openjdk.ms))} without` },
  { k: 'C extensions (numpy …)', cpy: 'binary wheels for everything', jar: 'need GraalPy builds; per platform' },
  { k: 'Calling Java libraries', cpy: 'through a bridge library (e.g. JPype)', jar: 'built in: import java, or pass Java objects in' },
];

export default function Page() {
  const [n, setN] = useState(10);
  const totals = RUNTIMES.map((r) => ({ ...r, t: r.total(n) }));
  const best = totals.reduce((a, b) => (b.t < a.t ? b : a));
  const max = Math.max(...totals.map((t) => t.t));
  // first n at which the GraalVM JAR beats CPython
  const cross = Array.from({ length: 500 }, (_, i) => i + 1).find((i) => RUNTIMES[2].total(i) < RUNTIMES[0].total(i));

  return (
    <Slide lead="A Flask JAR trades startup time and size for a single artifact, Java interop and, on a GraalVM JDK, much faster hot Python. Whether that pays off depends on how long the process lives.">
      <Card title="break-even: start a fresh process, then serve n CPU-bound requests">
        <label className="slider">
          <span>requests per process: <b>{n}</b></span>
          <input type="range" min={1} max={200} value={n} onChange={(e) => setN(+e.target.value)} />
        </label>
        <div className="race">
          {totals.map((r) => (
            <div key={r.id} className={`race-row ${best.id === r.id ? 'is-best' : ''}`} style={{ '--c': `var(--${r.tone})` } as CSSProperties}>
              <span className="race-label"><b>{r.label}</b> <span className="faint">{r.sub}</span></span>
              <div className="race-track">
                <div className="race-start" style={{ width: `${(r.startup / max) * 100}%` }} title="startup" />
                <div className="race-work" style={{ width: `${((r.t - r.startup) / max) * 100}%` }} />
              </div>
              <span className="race-t mono">{sec(r.t)}</span>
            </div>
          ))}
        </div>
        <Note tone={best.id === 'graalvm' ? 'green' : best.id === 'cpython' ? 'accent' : 'red'}>
          For {n} request{n > 1 ? 's' : ''}, <b>{best.label}</b> finishes first.{' '}
          {cross ? `With these measurements the GraalVM JAR overtakes CPython from request ${cross} on: about ${sec(RUNTIMES[2].startup)} of startup, then roughly ${Math.round(median(M.bench.cpython.ms) / steady(M.bench.graalvm.ms))}× faster per request.` : ''}{' '}
          The OpenJDK JAR never catches up on this workload: without a JIT it is slower than CPython at everything.
        </Note>
      </Card>
      <Grid cols="1fr" gap={0}>
        <table className="cmp">
          <thead><tr><th /><th>CPython + Flask</th><th>Flask in a GraalPy JAR</th></tr></thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.k}><td>{r.k}</td><td>{r.cpy}</td><td>{r.jar}</td></tr>
            ))}
          </tbody>
        </table>
      </Grid>
      <Callout tone="blue" title="When the JAR makes sense">
        Long-running services on a GraalVM JDK where Python logic is hot, or anywhere a Java shop wants to run Python without operating Python: one artifact, Java’s deployment and monitoring, and direct calls into existing Java libraries. For short-lived scripts, or apps that depend on C extensions, CPython is simpler. Native Image (an AOT-compiled binary) is the usual answer to the startup cost; it is not measured here.
      </Callout>
      <Measured>
        Startup = median of 3 cold starts to the first HTTP 200. CPython column: Python {M.bench.cpython.label.match(/[\d.]+/)?.[0]} running only the loop (no Flask, no HTTP), so it flatters CPython slightly. Beyond the 40 measured requests the model repeats the steady-state time. A CPU-bound endpoint was chosen on purpose; I/O-bound apps narrow every gap.
      </Measured>
    </Slide>
  );
}

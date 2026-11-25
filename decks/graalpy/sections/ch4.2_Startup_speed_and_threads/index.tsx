import { useState, type CSSProperties } from 'react';
import { Slide, Grid, Card, Segmented, Stat, Callout } from '@framework';
import { A, RT, RT_IDS, graalvmFlaskSteady, openjdkFlaskSteady, type RtId } from '../_shared/alt.ts';
import { sec } from '../_shared/data.ts';
import { Note, Measured, HBar } from '../_shared/ui.tsx';
import './style.css';

type Metric = 'startup' | 'loop' | 'threads';
const R = A.runtimes;
const T = R.jython.threads;

const ms = (x: number) => (x >= 1000 ? sec(x) : `${Math.round(x)} ms`);
/** 4 threads did 4x the work; how many threads' worth of work got done per unit time */
const par = (one: number, n: number) => (T * one) / n;

interface Row { id: string; rt: RtId; label: string; value: number; ref?: boolean }

const STARTUP: Row[] = RT_IDS.map((id) => ({ id, rt: id, label: RT[id].name, value: R[id].startupMs }));
const LOOP: Row[] = [
  ...RT_IDS.map((id) => ({ id, rt: id, label: `${RT[id].name}${id === 'graalpy' ? ' (OpenJDK: no JIT)' : id === 'jep' ? ` (= CPython ${R.jep.python})` : ''}`, value: R[id].primesSteadyMs })),
  { id: 'gvm', rt: 'graalpy', label: 'GraalPy on GraalVM JDK (JIT) *', value: graalvmFlaskSteady, ref: true },
];

const THREADS = [
  { id: 'jython', rt: 'jython' as RtId, label: 'Jython', sub: 'interpreter per thread, no GIL', one: R.jython.thread1Ms, n: R.jython.threadNMs },
  { id: 'jep', rt: 'jep' as RtId, label: 'JEP shared', sub: 'SharedInterpreter per thread, one GIL', one: R.jep.thread1Ms, n: R.jep.threadNMs },
  { id: 'jepi', rt: 'jep' as RtId, label: 'JEP isolated', sub: 'SubInterpreter, own GIL each', one: R.jep.isolated1Ms!, n: R.jep.isolatedNMs! },
  { id: 'graalpy', rt: 'graalpy' as RtId, label: 'GraalPy', sub: 'Context per thread, shared Engine', one: R.graalpy.thread1Ms, n: R.graalpy.threadNMs },
];

const NOTES: Record<Metric, { tone: 'green' | 'red' | 'blue' | 'accent'; text: string }> = {
  startup: { tone: 'blue', text: 'Time to create the interpreter and run workload.py, inside a JVM that is already up. JEP only has to initialise libpython, which is native and fast. Jython compiles its own site module and the workload to bytecode, mostly in a still-cold JVM. GraalPy loads a whole language runtime and, on a stock JDK, interprets its own startup code; chapter 3 measured the full Flask app at several seconds.' },
  loop: { tone: 'green', text: 'primes(200000) is a pure-Python loop: integer maths, comparisons, a while/else. Jython wins among the JIT-less setups because its Python is real JVM bytecode that HotSpot compiles on any JDK. JEP runs at exactly CPython speed. GraalPy without Graal is a Java interpreter interpreting Python: the slowest. With Graal, it is the fastest by far.' },
  threads: { tone: 'accent', text: `Each thread got its own interpreter and ran primes(${A.threadN.toLocaleString()}) once; ${T} threads therefore did ${T}× the work. A bar the same length as its 1-thread bar would mean perfect parallelism. JEP’s shared interpreters serialise on CPython’s single GIL. Isolated sub-interpreters (Python 3.12+) each have their own GIL and run in parallel, but extension modules must support that: numpy did not (see below).` },
};

function Bars({ rows, max }: { rows: Row[]; max: number }) {
  return (
    <div className="bars">
      {rows.map((r) => (
        <div key={r.id} className={`bar-row ${r.ref ? 'is-ref' : ''}`} style={{ '--rt': `var(--${RT[r.rt].tone})` } as CSSProperties}>
          <span className="bar-label">{r.label}</span>
          <HBar value={r.value} max={max} tone={RT[r.rt].tone} label={ms(r.value)} />
        </div>
      ))}
    </div>
  );
}

function Spark({ id }: { id: RtId }) {
  const xs = R[id].primesMs;
  const max = Math.max(...xs), W = 150, H = 34;
  const pts = xs.map((v, i) => `${(i / (xs.length - 1)) * W},${H - (v / max) * (H - 4)}`).join(' ');
  return (
    <div className="spark" style={{ '--rt': `var(--${RT[id].tone})` } as CSSProperties}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}><polyline points={pts} style={{ fill: 'none', stroke: 'var(--rt)', strokeWidth: 2 }} /></svg>
      <span className="small mono">{RT[id].name}: {ms(xs[0])} → {ms(xs[xs.length - 1])}</span>
    </div>
  );
}

export default function Page() {
  const [m, setM] = useState<Metric>('loop');
  const n = NOTES[m];
  return (
    <Slide lead="One harness per runtime, the same workload.py, the same JDK, three cold runs each. Pick what to compare.">
      <Segmented value={m} onChange={setM} options={[
        { value: 'startup', label: 'Startup' },
        { value: 'loop', label: 'Hot loop' },
        { value: 'threads', label: `1 vs ${T} threads` },
      ]} />
      <Grid cols="minmax(0, 1.5fr) minmax(0, 1fr)" gap={18}>
        <Card title={m === 'startup' ? 'create interpreter + run workload.py (median of 3)' : m === 'loop' ? 'primes(200000), warm: median of the last 10 of 15 calls' : `primes(${A.threadN.toLocaleString()}) per thread: wall time for 1 thread vs ${T} threads`}>
          {m === 'startup' && <Bars rows={STARTUP} max={Math.max(...STARTUP.map((r) => r.value))} />}
          {m === 'loop' && (
            <>
              <Bars rows={LOOP} max={Math.max(...LOOP.map((r) => r.value))} />
              <div className="sparks"><span className="faint small spark-h">warm-up, 15 calls in one interpreter (run 1):</span>{RT_IDS.map((id) => <Spark key={id} id={id} />)}</div>
            </>
          )}
          {m === 'threads' && (
            <div className="bars">
              {THREADS.map((t) => (
                <div key={t.id} className="thr" style={{ '--rt': `var(--${RT[t.rt].tone})` } as CSSProperties}>
                  <div className="thr-head"><b>{t.label}</b> <span className="faint small">{t.sub}</span><span className="spacer" /><span className={`par mono ${par(t.one, t.n) > 2 ? 'good' : 'bad'}`}>{par(t.one, t.n).toFixed(1)}× parallel</span></div>
                  <HBar value={t.one} max={Math.max(...THREADS.map((x) => x.n))} tone={RT[t.rt].tone} label={`1 thread  ${ms(t.one)}`} />
                  <HBar value={t.n} max={Math.max(...THREADS.map((x) => x.n))} tone={RT[t.rt].tone} label={`${T} threads ${ms(t.n)}`} />
                </div>
              ))}
            </div>
          )}
        </Card>
        <div className="col">
          <Note tone={n.tone}>{n.text}</Note>
          {m === 'loop' && (
            <Callout tone="muted" title="* the JIT bar is from chapter 1, not this harness">
              GraalVM was not available for this run, so the GraalVM bar is the warm Flask request from 1.4 ({ms(graalvmFlaskSteady)}, HTTP and JSON included). On stock OpenJDK that same request took {ms(openjdkFlaskSteady)} against {ms(R.graalpy.primesSteadyMs)} here, so the Flask figure is if anything an overestimate. To measure it directly: <code>JAVA=$GRAALVM/bin/java ./run.sh graalpy graalpy-jit</code>.
            </Callout>
          )}
          {m === 'threads' && (
            <Grid cols={2} gap={10}>
              <Stat label="JEP isolated + numpy" value="abort" tone="red" hint="JVM exits 134 when numpy is imported only in the sub-interpreter" />
              <Stat label="…numpy already loaded" value="ImportError" tone="red" hint="raised inside the sub-interpreter" />
            </Grid>
          )}
          {m === 'startup' && (
            <Grid cols={3} gap={10}>
              {RT_IDS.map((id) => <Stat key={id} label={RT[id].name} value={ms(R[id].startupMs)} hint={R[id].startupAll.map((x) => Math.round(x)).join(' / ') + ' ms'} />)}
            </Grid>
          )}
        </div>
      </Grid>
      <Measured>
        {A.machine}, {A.versions.jdk} for all three (stock OpenJDK: GraalPy runs without its JIT). Jython {A.versions.jython}, JEP {A.versions.jep} + CPython {A.versions.cpython}, GraalPy {A.versions.graalpy}. Re-run with decks/graalpy/example/alternatives/run.sh.
      </Measured>
    </Slide>
  );
}

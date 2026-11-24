import { useEffect } from 'react';
import { Slide, Grid, Stat, Callout, useStepper } from '@framework';
import { M, V, sec, steady } from '../_shared/data.ts';
import { Measured } from '../_shared/ui.tsx';
import './style.css';

const STAGES = [
  { id: 'src', title: 'app.py', sub: 'Python source', kind: 'py', what: 'Plain Python 3.12: the same file CPython would run.' },
  { id: 'parse', title: 'Parser + compiler', sub: 'written in Java', kind: 'gp', what: 'GraalPy parses the source and compiles each function to its own bytecode. No CPython is involved.' },
  { id: 'interp', title: 'Bytecode interpreter', sub: 'Truffle nodes', kind: 'gp', what: 'A Java interpreter built with Truffle. Its operations specialize themselves to the types they actually see.' },
  { id: 'hot', title: 'Hot?', sub: 'call + loop counters', kind: 'gp', what: 'Truffle counts calls and loop iterations. Code that stays cold is only ever interpreted.' },
  { id: 'pe', title: 'Partial evaluation', sub: 'Graal compiler', kind: 'jit', what: 'Graal compiles the interpreter specialized to this one function: the dispatch loop disappears, the Python code remains.' },
  { id: 'mc', title: 'Machine code', sub: 'with deopt exits', kind: 'jit', what: 'Fast native code, guarded by assumptions. If one breaks, execution falls back to the interpreter.' },
] as const;

export default function Cover() {
  const st = useStepper(STAGES.length + 1, 1300);
  const { step, atEnd, play, reset } = st;
  useEffect(() => {
    if (step === 0) play();
    if (atEnd) {
      const t = setTimeout(reset, 2200);
      return () => clearTimeout(t);
    }
  }, [step, atEnd, play, reset]);
  const cur = STAGES[Math.max(0, step - 1)];

  const gvm = steady(M.bench.graalvm.ms);
  const ojdk = steady(M.bench.openjdk.ms);

  return (
    <Slide
      title={<>Graal<span className="hl">Py</span>: Python on the JVM</>}
      lead="GraalPy is a Python 3 implementation written in Java on top of Truffle. Python code becomes data that a self-optimizing interpreter runs, and the Graal compiler turns the hot parts into machine code. Because it is ‘just Java’, an entire Python application, Flask included, can ship inside one JAR."
    >
      <div className="cov-pipe">
        {STAGES.map((s, i) => (
          <div key={s.id} className={`cov-stage k-${s.kind} ${step - 1 === i ? 'is-on' : ''} ${step - 1 > i ? 'is-past' : ''}`}>
            <b>{s.title}</b>
            <span>{s.sub}</span>
          </div>
        ))}
      </div>
      <div className="cov-what" key={cur.id}>
        <b>{cur.title}.</b> {cur.what}
      </div>

      <Grid cols={4}>
        <Stat label="Python version" value={V.python} hint={`GraalPy ${V.graalpy}`} tone="accent" />
        <Stat label="Flask app as one JAR" value={`${(M.jar.size / 1e6).toFixed(0)} MB`} hint={`java -jar, ${M.jar.files.toLocaleString()} files inside`} tone="blue" />
        <Stat label="Warm request, JIT on" value={sec(gvm)} hint="GraalVM JDK" tone="green" />
        <Stat label="Same request, no JIT" value={sec(ojdk)} hint="stock OpenJDK" tone="red" />
      </Grid>
      <Measured>
        GET /primes/200000 on the example Flask app, median of the last 10 of 40 requests. Chapter 1 explains the {Math.round(ojdk / gvm)}× gap; chapter 3 builds the JAR.
      </Measured>
      <Callout title="Three chapters">
        <b>1</b> how GraalPy executes Python · <b>2</b> how Java code embeds it · <b>3</b> a real Flask app built into a runnable JAR: the build, the JAR's contents, a request's path through it, and what it costs.
      </Callout>
    </Slide>
  );
}

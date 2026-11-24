import { Slide, Grid, Card, Stat, Callout, Code, StepControls, useStepper } from '@framework';
import { M, sec, steady, sum, median } from '../_shared/data.ts';
import { Note, Measured } from '../_shared/ui.tsx';
import './style.css';

const LANES = [
  { id: 'openjdk', tone: 'red', title: 'Stock OpenJDK 25', sub: 'Truffle fallback runtime: interpreter only', ms: M.bench.openjdk.ms },
  { id: 'graalvm', tone: 'green', title: 'GraalVM JDK 25', sub: 'Truffle + Graal JIT', ms: M.bench.graalvm.ms },
] as const;
const N = LANES[0].ms.length;
const MAX = Math.max(...LANES.flatMap((l) => l.ms));
const MIN = 10;
const cpy = median(M.bench.cpython.ms);
const y = (ms: number) => (Math.log10(Math.max(ms, MIN)) - Math.log10(MIN)) / (Math.log10(MAX) - Math.log10(MIN));

const WARNING = `[engine] WARNING: The polyglot engine uses a fallback runtime that does not
support runtime compilation to native code.
Execution without runtime compilation will negatively impact the guest
application performance.
The following cause was found: JVMCI is not enabled for this JVM.`;

function Chart({ ms, step, tone }: { ms: readonly number[]; step: number; tone: string }) {
  const W = 600, H = 120, bw = W / N;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H + 4}`} preserveAspectRatio="none">
      {[10, 100, 1000].map((g) => (
        <g key={g}>
          <line x1={0} x2={W} y1={H - y(g) * H} y2={H - y(g) * H} style={{ stroke: 'var(--border)' }} strokeDasharray="3 4" />
        </g>
      ))}
      {ms.map((v, i) => (
        <rect key={i} x={i * bw + 1.5} width={bw - 3} y={H - y(v) * H} height={y(v) * H} rx={2}
          style={{ fill: i < step ? `var(--${tone})` : 'var(--stripe)', opacity: i === step - 1 ? 1 : 0.75 }} />
      ))}
      <line x1={0} x2={W} y1={H - y(cpy) * H} y2={H - y(cpy) * H} style={{ stroke: 'var(--violet)' }} strokeWidth={2} />
    </svg>
  );
}

export default function Page() {
  const st = useStepper(N + 1, 260);
  const k = st.step;
  const leader = k ? (sum(LANES[1].ms.slice(0, k)) < sum(LANES[0].ms.slice(0, k)) ? 1 : 0) : -1;

  return (
    <Slide lead="Same JAR, same 40 requests, two JVMs. Only one of them has the Graal compiler. Press play.">
      {LANES.map((l, li) => (
        <Card key={l.id} title={<>{l.title} <span className="faint">· {l.sub}</span></>} tone={l.tone} aside={<span className="mono">{k ? <>req {k}: <b>{sec(l.ms[k - 1])}</b> · total <b>{sec(sum(l.ms.slice(0, k)))}</b></> : 'ready'}</span>}>
          <div className="lane">
            <div className="axis mono faint">
              {[1000, 100, 10].map((g) => <span key={g} style={{ top: `${(1 - y(g)) * 120 - 7}px` }}>{sec(g)}</span>)}
            </div>
            <Chart ms={l.ms} step={k} tone={l.tone} />
          </div>
          {li === 0 && <div className="legend small muted"><i /> CPython {M.bench.cpython.label.match(/[\d.]+/)?.[0]}, the same loop as a plain script: {sec(cpy)}</div>}
        </Card>
      ))}
      <StepControls stepper={st} label={`request ${k} / ${N}`} />
      <Grid cols={4}>
        <Stat label="first request, JIT" value={sec(LANES[1].ms[0])} tone="accent" hint="mostly interpreted while compiling" />
        <Stat label="steady state, JIT" value={sec(steady(LANES[1].ms))} tone="green" hint={`${Math.round(cpy / steady(LANES[1].ms))}× faster than CPython`} />
        <Stat label="steady state, no JIT" value={sec(steady(LANES[0].ms))} tone="red" hint={`${(steady(LANES[0].ms) / cpy).toFixed(1)}× slower than CPython`} />
        <Stat label="all 40 requests, JIT" value={sec(sum(LANES[1].ms))} tone="violet" hint={`vs ${sec(sum(LANES[0].ms))} without JIT`} />
      </Grid>
      <Grid cols="1fr 1fr" gap={16}>
        <Note tone={leader === 1 ? 'green' : 'red'}>
          {k === 0 && 'Each bar is one request (log scale). The violet line is CPython running the same loop with no web framework around it.'}
          {k > 0 && k < 3 && 'Early on the two are close: the JIT run is still interpreting while Graal compiles primes() on background threads (see 1.3).'}
          {k >= 3 && k < N && 'From the third request the JIT version runs machine code specialized for small ints in this loop. The interpreter-only run never gets faster: without a compiler, warm-up changes nothing.'}
          {k === N && `Done. The interpreter-only JVM spent ${sec(sum(LANES[0].ms))} on what the JIT did in ${sec(sum(LANES[1].ms))}. Both ran the identical JAR; the difference is only whether a Graal compiler was present.`}
        </Note>
        <Code code={WARNING} lang="text" className="warn" />
      </Grid>
      <Callout title="Getting the JIT" tone="blue">
        Run the JAR on a <b>GraalVM JDK</b> (what the green run used), or build a native executable with Native Image, which includes the compiler. The warning above names a third route, a JVMCI-enabled OpenJDK with the Graal compiler added; the documented setup for that uses the module path rather than one fat JAR on the classpath.
      </Callout>
      <Measured>
        GET /primes/200000 (plain Python loops), 40 times on one fresh JVM per run, {M.machine}. CPython ran only the loop, with no Flask and no HTTP, so it is a lower bound for CPython. Numbers are from one machine; treat ratios as indicative.
      </Measured>
    </Slide>
  );
}

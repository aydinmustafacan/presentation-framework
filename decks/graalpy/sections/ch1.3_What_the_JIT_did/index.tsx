import { useMemo, useState } from 'react';
import { Slide, Grid, Card, Code, Segmented, Tag, StepControls, useStepper } from '@framework';
import { M, sec, type TraceEvent } from '../_shared/data.ts';
import { appPy, lineOf, linesBetween } from '../_shared/sources.ts';
import { Note, Label, Measured, HBar } from '../_shared/ui.tsx';
import './style.css';

const t = (e: TraceEvent) => Date.parse(e.utc + 'Z');
const isPrimes = (e: TraceEvent) => e.target.includes('bytecode primes');
const isOsr = (e: TraceEvent) => e.target.includes('<OSR@');

function explain(e: TraceEvent): { title: string; text: string; tone: 'green' | 'red' | 'accent' } {
  if (e.kind === 'done' && isOsr(e))
    return { title: `OSR compile, tier ${e.tier}`, tone: 'green', text: `On-stack replacement. The loop inside primes() got hot while the function was still in its first call, so Truffle compiled just the loop (${e.compileMs} ms, ${e.codeSize} bytes of machine code) and jumped into it in the middle of execution. Without OSR, a long-running first call could never leave the interpreter.` };
  if (e.kind === 'deopt')
    return { title: 'Deoptimization', tone: 'red', text: 'Execution left compiled code and continued in the interpreter at the exact same point, with the same local variables. The log does not record the cause. Deopts are normal during warm-up: the compiled code met something it had not planned for.' };
  if (e.kind === 'invalidate')
    return { title: 'Invalidated', tone: 'red', text: `The compiled loop was thrown away because an assumption it was built on stopped being true. Reason given: “${e.reason}”. Truffle had just split a call node (given a callee its own private copy so it can specialize for this caller), and the old code was compiled against the old call tree.` };
  if (e.tier === 1)
    return { title: 'Tier 1 compile of primes()', tone: 'green', text: `The first tier: a quick compile with little inlining (${e.inlined} calls inlined), ${e.compileMs} ms, ${e.codeSize.toLocaleString()} bytes. The goal is to get off the interpreter fast, not to produce the best code.` };
  return { title: 'Tier 2 compile of primes()', tone: 'green', text: `The optimizing tier: ${e.inlined} calls inlined, ${e.compileMs} ms of compile time on a background thread, ${e.codeSize!.toLocaleString()} bytes of machine code (${Math.round(e.codeSize! / 3372)}× the tier-1 version). The timestamps show it finished after requests 3–6 had already been served at ~22 ms by tier-1 code.` };
}

const GROUPS = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'app.py' },
  { value: 'py', label: 'Python library code' },
  { value: 'java', label: 'Builtins in Java' },
] as const;
type Group = (typeof GROUPS)[number]['value'];
const groupOf = (e: TraceEvent): Group => (e.target.startsWith('<builtin') || !e.target.startsWith('<') ? 'java' : e.src?.startsWith('app.py') || isPrimes(e) ? 'mine' : 'py');

export default function Page() {
  const events = useMemo(() => M.trace.filter(isPrimes), []);
  const t0 = t(events[0]);
  const st = useStepper(events.length + 1, 1600);
  const ev = st.step ? events[st.step - 1] : null;
  const ex = ev && explain(ev);
  const [group, setGroup] = useState<Group>('all');
  const all = M.trace.filter((e) => e.kind === 'done');
  const shown = all.filter((e) => group === 'all' || groupOf(e) === group);
  const counts = Object.fromEntries(GROUPS.map((g) => [g.value, all.filter((e) => g.value === 'all' || groupOf(e) === g.value).length]));
  const loop = linesBetween(appPy, 'for k in range(2, n)', 'count += 1');
  const fn = lineOf(appPy, 'def primes');

  return (
    <Slide lead="The previous page was a model. This is the real thing: the Truffle compilation log of the Flask app in the JAR, running on a GraalVM JDK while six identical requests hit /primes/200000.">
      <Grid cols="1fr 1.25fr" gap={18}>
        <Card title="six identical requests">
          <div className="reqs">
            {M.traceRequests.map((ms, i) => (
              <div className="req" key={i}>
                <span className="faint mono small">#{i + 1}</span>
                <HBar value={ms} max={M.traceRequests[0]} tone={ms > 500 ? 'red' : ms > 50 ? 'accent' : 'green'} label={sec(ms)} />
              </div>
            ))}
          </div>
          <Label style={{ marginTop: 14 }}>the function being compiled (app.py)</Label>
          <Code
            code={appPy.split('\n').slice(fn - 1, loop[loop.length - 1] + 1).join('\n')}
            lang="py"
            active={ev && isOsr(ev) ? loop.map((l) => l - fn + 1) : ev ? Array.from({ length: loop[loop.length - 1] - fn + 2 }, (_, i) => i + 1) : []}
            dim
          />
        </Card>
        <div className="col">
          <Label>compilation events for primes(), in order</Label>
          <div className="events">
            {events.map((e, i) => (
              <button key={i} className={`event k-${e.kind} ${st.step === i + 1 ? 'is-on' : ''} ${st.step <= i ? 'is-future' : ''}`} onClick={() => st.goTo(i + 1)}>
                <span className="ev-time">+{t(e) - t0} ms</span>
                <span className="ev-kind">{e.kind === 'done' ? `compiled · tier ${e.tier}` : e.kind}</span>
                <span className="ev-target">{isOsr(e) ? 'loop (OSR)' : 'whole function'}</span>
                <span className="ev-num">{e.compileMs != null ? `${e.compileMs} ms · ${e.codeSize!.toLocaleString()} B` : ''}</span>
              </button>
            ))}
          </div>
          <Note tone={ex?.tone}>{ex ? <><b>{ex.title}.</b> {ex.text}</> : 'Step through the seven events Truffle logged for primes(). Request 1 took a second, request 3 took 22 ms: everything in between is on this list.'}</Note>
          <StepControls stepper={st} label={`event ${st.step} / ${events.length}`} />
        </div>
      </Grid>

      <Card title={`everything else that got compiled in the same ${((t(M.trace[M.trace.length - 1]) - t(M.trace[0])) / 1000).toFixed(1)} s`} aside={<Segmented value={group} onChange={setGroup} options={GROUPS.map((g) => ({ value: g.value, label: `${g.label} (${counts[g.value]})` }))} />}>
        <div className="all-events">
          {shown.map((e, i) => (
            <span key={i} className={`chip g-${groupOf(e)}`} title={`${e.target}\ntier ${e.tier}, ${e.compileMs} ms, ${e.codeSize} B${e.src && e.src !== 'n/a' ? `\n${e.src}` : ''}`}>
              {e.target.replace(/^<(builtin function |bytecode )?/, '').replace(/ at [0-9a-f]+>.*$/, '').replace(/>$/, '').replace(/ \(generator resume.*$/, '')}
              {e.tier === 2 && <Tag tone="green">T2</Tag>}
            </span>
          ))}
        </div>
      </Card>
      <Measured>
        <code>-Dpolyglot.engine.TraceCompilation=true</code>, GraalVM CE 25.0.1, GraalPy {M.versions.graalpy}. Raw log: example/flask-jar/trace-graalvm.log. Java builtins are GraalPy’s own implementations of things like <code>object.__getattribute__</code>; they get compiled exactly like Python code.
      </Measured>
    </Slide>
  );
}

import { useMemo, useState } from 'react';
import { Slide, Grid, Card, Code, Segmented, Stat, Callout, StepControls, useStepper } from '@framework';
import { run, PRESETS, SPECS, THRESHOLD, compiledCode, type SpecId } from '../_shared/specialize.ts';
import { Note, Label } from '../_shared/ui.tsx';
import './style.css';

const ORDER: SpecId[] = ['int', 'bigint', 'float', 'mixed', 'str', 'generic'];
const EVENT = { start: ['', ''], interp: ['I', 'interpreted'], compile: ['C', 'interpreted, then compiled'], fast: ['F', 'compiled code'], deopt: ['D', 'deoptimized'] } as const;

export default function Page() {
  const [preset, setPreset] = useState(PRESETS[2].id);
  const pairs = PRESETS.find((p) => p.id === preset)!.pairs;
  const trace = useMemo(() => run(pairs), [pairs]);
  const st = useStepper(trace.length, 1100);
  const s = trace[st.step];

  return (
    <Slide lead={<>In Truffle every operation is a node that rewrites itself. The <code>+</code> in a loop starts with no idea what it adds. It activates a fast path for each type combination it actually meets, and the compiler only ever compiles the paths that were used.</>}>
      <div className="row">
        <Segmented
          value={preset}
          onChange={(v) => { setPreset(v); st.reset(); }}
          options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
        />
      </div>
      <Grid cols="1fr 1fr 230px" gap={16}>
        <Card title={<>the <code>a + b</code> node: specializations</>}>
          <div className="specs">
            {ORDER.map((id) => {
              const active = s.active.includes(id);
              const inCode = s.compiled?.includes(id);
              return (
                <div
                  key={id + (s.activated === id ? s.call : '')}
                  className={`spec ${active ? 'is-active' : ''} ${inCode ? 'is-compiled' : ''} ${s.handledBy === id && s.call ? 'is-now' : ''} ${s.activated === id ? 'is-new' : ''}`}
                  title={SPECS[id].why}
                >
                  <span className="spec-dot" />
                  <span className="spec-name">{SPECS[id].label}</span>
                  <span className="spec-hits">{s.hits[id] ?? ''}</span>
                </div>
              );
            })}
          </div>
          <div className="spec-legend">
            <span><i className="lg-active" /> active</span>
            <span><i className="lg-compiled" /> in compiled code</span>
            <span><i className="lg-now" /> handled this call</span>
          </div>
        </Card>

        <Card title={s.compiled ? 'compiled machine code (pseudo)' : 'no machine code yet'} tone={s.compiled ? 'green' : 'muted'}>
          {s.compiled ? (
            <Code code={compiledCode(s.compiled)} lang="ts" />
          ) : (
            <div className="interp-only">
              Interpreting. The node runs through Truffle’s generic execute path with a type check per case.
              <div className="meter">
                <div style={{ width: `${(Math.min(s.sinceCompile, THRESHOLD) / THRESHOLD) * 100}%` }} />
              </div>
              <span className="faint small">{s.sinceCompile} / {THRESHOLD} calls until it counts as hot</span>
            </div>
          )}
        </Card>

        <div className="side">
          <div className="call">
            <Label>call {s.call || '–'}</Label>
            <div className="call-expr">{s.a ? <>{s.a.text} <span className="op">+</span> {s.b!.text}</> : 'not run yet'}</div>
            {s.result && <div className="call-res">= {s.result}</div>}
          </div>
          <Grid cols={2} gap={8}>
            <Stat label="compiles" value={s.compiles} tone="green" />
            <Stat label="deopts" value={s.deopts} tone="red" />
          </Grid>
          <div className="timeline">
            {trace.slice(1).map((t, i) => (
              <span key={i} className={`ev ev-${t.event} ${i + 1 === st.step ? 'is-cur' : ''} ${i + 1 > st.step ? 'is-future' : ''}`} title={EVENT[t.event][1]} onClick={() => st.goTo(i + 1)}>
                {EVENT[t.event][0]}
              </span>
            ))}
          </div>
        </div>
      </Grid>
      <Note tone={s.event === 'deopt' ? 'red' : s.event === 'fast' || s.event === 'compile' ? 'green' : 'accent'}>{s.note}</Note>
      <StepControls stepper={st} label={`call ${st.step} / ${st.total - 1}`} />
      <Callout tone="muted" title="A simplified model">
        Real GraalPy nodes have more cases and different names, and real compile thresholds are hundreds to thousands of calls and loop iterations, not {THRESHOLD}. The mechanics are real: per-node specializations (Truffle DSL <code>@Specialization</code>), compiling only the active ones, and deoptimizing when a guard fails. Section 1.3 shows them happening in the real Flask app.
      </Callout>
    </Slide>
  );
}

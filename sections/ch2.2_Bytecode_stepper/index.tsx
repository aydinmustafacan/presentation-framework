import { useMemo, useState } from 'react';
import { Slide, Card, Code, Segmented, StepControls, useStepper, Stat, Tag } from '@framework';
import { run, simMethod, PROGRAMS, type ProgramName } from '../_shared/stackvm.ts';
import { formatIns, lineForOffset, methodSource, JAVAC_VERSION } from '../_shared/bytecode.ts';
import { OperandStack, Locals, Note, NumberInputs } from '../_shared/widgets.tsx';
import '../_shared/sim.css';

export default function Page() {
  const [prog, setProg] = useState<ProgramName>('sum');
  const [args, setArgs] = useState<number[]>([...PROGRAMS.sum.defaults]);
  const trace = useMemo(() => run(prog, args), [prog, args]);
  const st = useStepper(trace.length, 650);
  const snap = trace[Math.min(st.step, trace.length - 1)];
  const top = snap.frames[snap.frames.length - 1];
  const m = simMethod(top.method);
  const src = methodSource('Sim', top.method);

  // highlight the instruction that produced this state if it ran in the visible frame; else the next one
  const ex = snap.executed;
  const hi = ex && ex.method === top.method && ex.depth === snap.frames.length - 1 ? ex.index : st.step === 0 ? -1 : top.pc;
  const javaLine = hi >= 0 ? lineForOffset(m, m.code[hi].offset) : undefined;
  const prevLocals = trace[Math.max(0, st.step - 1)].frames[snap.frames.length - 1]?.locals ?? [];
  const changed = top.locals.map((v, i) => (st.step > 0 && v !== prevLocals[i] ? i : -1)).filter((i) => i >= 0);

  const choose = (p: ProgramName) => {
    setProg(p);
    setArgs([...PROGRAMS[p].defaults]);
    st.reset();
  };

  return (
    <Slide lead="Real javac output, executed one instruction at a time. Watch how every value travels through the operand stack — even to add two locals together.">
      <div className="row">
        <Segmented value={prog} onChange={choose} options={(Object.keys(PROGRAMS) as ProgramName[]).map((p) => ({ value: p, label: PROGRAMS[p].label }))} />
        <span className="spacer" />
        <NumberInputs
          names={PROGRAMS[prog].params}
          values={args}
          min={prog === 'fact' ? 0 : -99}
          max={prog === 'fact' ? 8 : prog === 'sum' ? 30 : 999}
          onChange={(v) => {
            setArgs(v);
            st.reset();
          }}
        />
      </div>

      <div className="sim-grid">
        <Card title="Sim.java" aside={snap.frames.length > 1 ? <Tag tone="violet">call depth {snap.frames.length}</Tag> : null}>
          <Code code={src.code} lang="java" active={javaLine ? javaLine - src.firstLine + 1 : undefined} dim />
          <div className="sim-sig mono small muted">{m.decl}</div>
        </Card>
        <Card title="Bytecode" aside={<span className="faint small mono">{JAVAC_VERSION}</span>}>
          <Code code={m.code.map((i) => formatIns(i, { comment: false })).join('\n')} lang="jvm" active={hi >= 0 ? hi + 1 : undefined} />
        </Card>
        <Card title="Frame">
          <div className="sim-frame">
            <Locals names={top.localNames} values={top.locals} changed={changed} />
            <OperandStack values={top.stack} pushed={snap.pushed} capacity={top.maxStack} />
          </div>
        </Card>
      </div>

      <Note done={snap.done}>
        {snap.done ? (
          <>
            <b className="mono" style={{ color: 'var(--green)' }}>
              {prog}({args.join(', ')}) = {snap.result}
            </b>{' '}
            — {snap.note}
          </>
        ) : (
          snap.note
        )}
      </Note>
      <StepControls stepper={st} label={`instruction ${snap.stats.instructions}`} />

      <div className="sim-stats">
        <Stat label="instructions dispatched" value={snap.stats.instructions} />
        <Stat label="operand-stack pushes" value={snap.stats.pushes} tone="violet" />
        <Stat label="operand-stack pops" value={snap.stats.pops} tone="violet" />
        <Stat label="local reads / writes" value={`${snap.stats.localReads} / ${snap.stats.localWrites}`} tone="blue" />
      </div>
    </Slide>
  );
}

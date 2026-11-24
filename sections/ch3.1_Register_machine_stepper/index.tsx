import { useMemo, useState } from 'react';
import { Slide, Card, Code, Segmented, StepControls, useStepper, Stat, Tag, Callout } from '@framework';
import { PROGRAMS, type ProgramName } from '../_shared/stackvm.ts';
import { methodSource } from '../_shared/bytecode.ts';
import { REG_PROGRAMS, runReg, formatReg, regLineOf } from '../_shared/regvm.ts';
import { Registers, Note, NumberInputs } from '../_shared/widgets.tsx';
import '../_shared/sim.css';

export default function Page() {
  const [prog, setProg] = useState<ProgramName>('sum');
  const [args, setArgs] = useState<number[]>([...PROGRAMS.sum.defaults]);
  const trace = useMemo(() => runReg(prog, args), [prog, args]);
  const st = useStepper(trace.length, 800);
  const snap = trace[Math.min(st.step, trace.length - 1)];
  const top = snap.frames[snap.frames.length - 1];
  const p = REG_PROGRAMS[top.method];
  const src = methodSource('Sim', top.method);
  const ex = snap.executed;
  const hi = ex && ex.method === top.method && ex.depth === snap.frames.length - 1 ? ex.index : st.step === 0 ? -1 : top.pc;
  const javaLine = hi >= 0 ? p.javaLines[hi] : undefined;

  const choose = (q: ProgramName) => {
    setProg(q);
    setArgs([...PROGRAMS[q].defaults]);
    st.reset();
  };

  return (
    <Slide lead="The same five methods, hand-lowered to Dalvik-style register code the way Android’s d8 compiler does it. No operand stack: instructions read and write a fixed set of virtual registers.">
      <div className="row">
        <Segmented value={prog} onChange={choose} options={(Object.keys(PROGRAMS) as ProgramName[]).map((q) => ({ value: q, label: PROGRAMS[q].label }))} />
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
        </Card>
        <Card title="Register code (smali)" tone="blue">
          <Code code={formatReg(p)} lang="asm" active={hi >= 0 ? regLineOf(p, hi) : undefined} />
        </Card>
        <Card title="Frame">
          <Registers regs={top.regs} read={snap.read} wrote={snap.wrote} />
        </Card>
      </div>

      <Note done={snap.done}>
        {snap.done && (
          <b className="mono" style={{ color: 'var(--green)' }}>
            {prog}({args.join(', ')}) = {snap.result}{' '}
          </b>
        )}
        {snap.note}
      </Note>
      <StepControls stepper={st} label={`instruction ${snap.stats.instructions}`} />

      <div className="sim-stats">
        <Stat label="instructions dispatched" value={snap.stats.instructions} tone="blue" />
        <Stat label="register reads" value={snap.stats.regReads} tone="blue" />
        <Stat label="register writes" value={snap.stats.regWrites} tone="green" />
        <Stat label="code units fetched (×2 bytes)" value={snap.stats.units} tone="violet" />
      </div>
      <Callout tone="blue" title="Honest labelling">
        The JVM bytecode in this deck is real <code>javac</code> output. The register code is hand-translated in Dalvik’s format (instruction names,
        operand forms and code-unit sizes are Dalvik’s), since compiling with d8 needs the Android SDK.
      </Callout>
    </Slide>
  );
}

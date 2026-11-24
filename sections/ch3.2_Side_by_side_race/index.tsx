import { useMemo, useState } from 'react';
import { Slide, Card, Code, Segmented, StepControls, useStepper, Tag } from '@framework';
import { run, simMethod, PROGRAMS, type ProgramName } from '../_shared/stackvm.ts';
import { codeSize, formatIns } from '../_shared/bytecode.ts';
import { REG_PROGRAMS, runReg, formatReg, regLineOf, staticSize } from '../_shared/regvm.ts';
import { Bars, NumberInputs, OperandStack, Registers } from '../_shared/widgets.tsx';
import './style.css';

function highlight(executed: { method: string; index: number } | undefined, method: string) {
  return executed && executed.method === method ? executed.index : -1;
}

export default function Page() {
  const [prog, setProg] = useState<ProgramName>('gcd');
  const [args, setArgs] = useState<number[]>([...PROGRAMS.gcd.defaults]);
  const S = useMemo(() => run(prog, args), [prog, args]);
  const R = useMemo(() => runReg(prog, args), [prog, args]);
  const st = useStepper(Math.max(S.length, R.length), 450);
  const s = S[Math.min(st.step, S.length - 1)];
  const r = R[Math.min(st.step, R.length - 1)];
  const sTop = s.frames[s.frames.length - 1];
  const rTop = r.frames[r.frames.length - 1];
  const sm = simMethod(sTop.method);
  const rp = REG_PROGRAMS[rTop.method];
  const sHi = highlight(s.executed, sTop.method);
  const rHi = highlight(r.executed, rTop.method);

  const sFinal = S[S.length - 1].stats;
  const rFinal = R[R.length - 1].stats;

  const choose = (p: ProgramName) => {
    setProg(p);
    setArgs([...PROGRAMS[p].defaults]);
    st.reset();
  };

  return (
    <Slide lead="Both machines run the same method in lock-step: one instruction per tick each. The register machine finishes first — but count the bytes.">
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

      <div className="race">
        <Card
          title="Stack · JVM"
          tone="accent"
          aside={s.done ? <Tag tone="green">done in {sFinal.instructions} · result {s.result}</Tag> : <Tag tone="accent">{s.stats.instructions} executed</Tag>}
        >
          <div className="race-body">
            <Code code={sm.code.map((i) => formatIns(i, { comment: false })).join('\n')} lang="jvm" active={sHi >= 0 ? sHi + 1 : undefined} />
            <OperandStack values={sTop.stack} pushed={s.pushed} capacity={sTop.maxStack} compact />
          </div>
          <Progress value={s.stats.instructions} max={Math.max(sFinal.instructions, rFinal.instructions)} tone="accent" />
        </Card>
        <Card
          title="Register · Dalvik-style"
          tone="blue"
          aside={r.done ? <Tag tone="green">done in {rFinal.instructions} · result {r.result}</Tag> : <Tag tone="blue">{r.stats.instructions} executed</Tag>}
        >
          <div className="race-body">
            <Code code={formatReg(rp)} lang="asm" active={rHi >= 0 ? regLineOf(rp, rHi) : undefined} />
            <Registers regs={rTop.regs} read={r.read} wrote={r.wrote} />
          </div>
          <Progress value={r.stats.instructions} max={Math.max(sFinal.instructions, rFinal.instructions)} tone="blue" />
        </Card>
      </div>

      <StepControls stepper={st} label={`tick ${st.step}`} />

      <Card title={`Totals for ${prog}(${args.join(', ')})`}>
        <Bars
          rows={[
            { label: 'instructions dispatched', stack: sFinal.instructions, reg: rFinal.instructions },
            { label: 'static code size', stack: codeSize(simMethod(prog)), reg: staticSize(REG_PROGRAMS[prog]), unit: ' B' },
            { label: 'bytes fetched at run time', stack: bytesFetched(S), reg: rFinal.units * 2, unit: ' B' },
            { label: 'data moves (stack push/pop, local or register read/write)', stack: sFinal.pushes + sFinal.pops + sFinal.localReads + sFinal.localWrites, reg: rFinal.regReads + rFinal.regWrites },
          ]}
        />
      </Card>
    </Slide>
  );
}

/** Sum of the byte lengths of every executed JVM instruction. */
function bytesFetched(trace: ReturnType<typeof run>) {
  let total = 0;
  for (const snap of trace) {
    if (!snap.executed) continue;
    const m = simMethod(snap.executed.method);
    const i = snap.executed.index;
    const next = m.code[i + 1];
    total += next ? next.offset - m.code[i].offset : 1;
  }
  return total;
}

function Progress({ value, max, tone }: { value: number; max: number; tone: 'accent' | 'blue' }) {
  return (
    <div className="race-progress">
      <div style={{ width: `${(value / max) * 100}%`, background: `var(--${tone})` }} />
    </div>
  );
}

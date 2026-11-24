import { useMemo, useState } from 'react';
import { Slide, Card, Code, StepControls, useStepper, Tag, Callout } from '@framework';
import { run, simMethod } from '../_shared/stackvm.ts';
import { formatIns, lineForOffset, methodSource } from '../_shared/bytecode.ts';
import { Note, NumberInputs } from '../_shared/widgets.tsx';
import './style.css';

export default function Page() {
  const [n, setN] = useState(3);
  const trace = useMemo(() => run('fact', [n]), [n]);
  const st = useStepper(trace.length, 900);
  const snap = trace[st.step];
  const m = simMethod('fact');
  const src = methodSource('Sim', 'fact');
  const top = snap.frames[snap.frames.length - 1];
  const nextIdx = snap.done ? -1 : top.pc;
  const line = nextIdx >= 0 ? lineForOffset(m, m.code[nextIdx].offset) : undefined;

  return (
    <Slide lead="Each method call gets a frame: a local-variable array and its own operand stack, sized at compile time (max_locals, max_stack). Calls push frames; returns pop them.">
      <div className="fr-grid">
        <div className="fr-left">
          <Card title="Recursive factorial">
            <Code code={src.code} lang="java" active={line ? line - src.firstLine + 1 : undefined} dim />
          </Card>
          <Card title="Bytecode of fact(int)" aside={<span className="faint small">▶ = next instruction of the top frame</span>}>
            <Code code={m.code.map((i) => formatIns(i)).join('\n')} lang="jvm" active={nextIdx >= 0 ? nextIdx + 1 : undefined} />
          </Card>
        </div>

        <div className="fr-right">
          <div className="row">
            <NumberInputs
              names={['n']}
              values={[n]}
              min={1}
              max={6}
              onChange={([v]) => {
                setN(v);
                st.reset();
              }}
            />
            <span className="spacer" />
            <Tag tone="violet">thread stack · {snap.frames.length} frame{snap.frames.length > 1 ? 's' : ''}</Tag>
          </div>
          <div className="fr-stack">
            {[...snap.frames].reverse().map((f, k) => {
              const depth = snap.frames.length - 1 - k;
              const current = k === 0;
              const pcIns = m.code[f.pc];
              return (
                <div key={depth} className={`frame-card ${current ? 'is-current' : 'is-waiting'}`}>
                  <div className="fr-head">
                    <span className="mono">
                      fact(<b>{f.locals[0]}</b>)
                    </span>
                    <span className="faint small mono">{current ? (snap.done ? 'returned' : `pc → ${pcIns ? formatIns(pcIns, { comment: false, pad: 0 }).replace(/\s+/g, ' ') : ''}`) : `waiting at ${m.code[f.pc - 1].offset}: invokestatic`}</span>
                  </div>
                  <div className="fr-body">
                    <div>
                      <div className="w-label">locals</div>
                      <div className="chips">
                        {f.locals.map((v, i) => (
                          <span key={i} className="chip is-local">
                            <i>{f.localNames[i]}</i>
                            {v ?? '—'}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="w-label">operand stack (max {f.maxStack}) →top</div>
                      <div className="chips">
                        {f.stack.length === 0 && <span className="chip is-empty">empty</span>}
                        {f.stack.map((v, i) => (
                          <span key={`${i}-${v}`} className={`chip is-op ${i === f.stack.length - 1 ? 'is-top' : ''}`}>
                            {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Note done={snap.done}>{snap.done ? <b style={{ color: 'var(--green)' }}>fact({n}) = {snap.result}. </b> : null}{snap.note}</Note>
      <StepControls stepper={st} />
      <Callout tone="violet" title="Why it matters">
        Frames are private to a thread, so locals need no synchronisation. Too-deep recursion exhausts the thread stack: <code>StackOverflowError</code>.
        And the garbage collector finds live objects by scanning exactly these locals and operand stacks.
      </Callout>
    </Slide>
  );
}

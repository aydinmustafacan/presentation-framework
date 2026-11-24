import { useEffect } from 'react';
import { Slide, Card, Code, Grid, useStepper } from '@framework';
import { OperandStack } from '../_shared/widgets.tsx';

const PROGRAM = [
  { ins: 'iconst_2', stack: [2], say: 'push 2' },
  { ins: 'iconst_3', stack: [2, 3], say: 'push 3' },
  { ins: 'iadd', stack: [5], say: 'pop 3, pop 2, push 5' },
  { ins: 'iconst_4', stack: [5, 4], say: 'push 4' },
  { ins: 'imul', stack: [20], say: 'pop 4, pop 5, push 20' },
];

export default function Page() {
  const st = useStepper(PROGRAM.length + 1, 1100);
  // loop forever as an ambient demo
  const { step, atEnd, play, reset } = st;
  useEffect(() => {
    if (step === 0) play();
    if (atEnd) {
      const t = setTimeout(reset, 1800);
      return () => clearTimeout(t);
    }
  }, [step, atEnd, play, reset]);

  const cur = st.step === 0 ? null : PROGRAM[st.step - 1];
  const pushed = cur ? 1 : 0; // every instruction here leaves exactly one new value on top

  return (
    <Slide lead="A stack machine has no named registers. Instructions take their inputs from the top of an operand stack and push their result back. That’s the whole idea.">
      <Grid cols="1fr 1fr 220px" gap={20}>
        <Card title="Java">
          <Code code="int r = (2 + 3) * 4;" lang="java" />
          <p className="muted small" style={{ marginTop: 14 }}>
            The compiler walks the expression tree in post-order — children first, then the operator. The output is the expression in reverse Polish
            notation: <code>2 3 + 4 ×</code>.
          </p>
        </Card>
        <Card title="Bytecode">
          <Code code={PROGRAM.map((p) => `${p.ins.padEnd(10)}// ${p.say}`).join('\n')} lang="jvm" active={st.step || undefined} dim />
        </Card>
        <Card title="Stack">
          <OperandStack values={cur?.stack ?? []} pushed={pushed} capacity={2} label="" />
        </Card>
      </Grid>

      <Grid cols={3}>
        <Card title="Compact" tone="accent">
          No operand fields: <code>iadd</code> is one byte. Bytecode was designed in the 1990s to be shipped over slow networks to applets.
        </Card>
        <Card title="Easy to target" tone="accent">
          A compiler just emits a post-order walk. No register allocation — that hard problem is left to the JIT, which knows the real CPU.
        </Card>
        <Card title="Easy to verify" tone="accent">
          At every instruction the stack depth and types are fixed, so the verifier can prove a method safe in one pass before it runs.
        </Card>
      </Grid>
    </Slide>
  );
}

import { Slide, Card, Code, Grid, Callout, Tag } from '@framework';
import { simMethod } from '../_shared/stackvm.ts';
import { codeSize, formatIns } from '../_shared/bytecode.ts';
import { REG_PROGRAMS, formatReg, staticSize } from '../_shared/regvm.ts';

export default function Page() {
  const jvm = simMethod('arith');
  const reg = REG_PROGRAMS.arith;
  return (
    <Slide lead="There are two classic ways to design a virtual instruction set. The JVM, CPython and WebAssembly chose a stack. Android’s Dalvik/ART, Lua 5 and BEAM (Erlang) chose registers. Same program, both ways:">
      <Code code="static int arith(int a, int b, int c) { return (a + b) * c; }" lang="java" />
      <Grid cols={2}>
        <Card title="Stack machine — JVM bytecode" tone="accent" aside={<Tag tone="accent">{jvm.code.length} instructions · {codeSize(jvm)} bytes</Tag>}>
          <Code code={jvm.code.map((i) => formatIns(i)).join('\n')} lang="jvm" />
          <p className="muted small" style={{ marginTop: 12 }}>
            Operands are <b>implicit</b>: every instruction works on the top of the stack. Values must be loaded onto the stack before use.
          </p>
        </Card>
        <Card title="Register machine — Dalvik bytecode" tone="blue" aside={<Tag tone="blue">{reg.code.length} instructions · {staticSize(reg)} bytes</Tag>}>
          <Code code={formatReg(reg)} lang="asm" />
          <p className="muted small" style={{ marginTop: 12 }}>
            Operands are <b>explicit</b>: each instruction names its source and destination registers. Arguments are already in registers
            (<code>p0–p2</code>).
          </p>
        </Card>
      </Grid>
      <Callout title="The trade-off in one line">
        The stack version dispatches <b>twice as many</b> instructions but each is tiny; the register version dispatches fewer, fatter ones. Which wins
        depends on what is expensive: instruction dispatch in an interpreter, or bytes on the wire and in memory. The next pages measure it.
      </Callout>
    </Slide>
  );
}

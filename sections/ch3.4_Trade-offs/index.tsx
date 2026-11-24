import { useMemo, useState } from 'react';
import { Slide, Card, Grid, Tag, Callout } from '@framework';
import { run, simMethod, PROGRAMS, type ProgramName } from '../_shared/stackvm.ts';
import { codeSize } from '../_shared/bytecode.ts';
import { REG_PROGRAMS, runReg, staticSize } from '../_shared/regvm.ts';
import './style.css';

const ROWS: [string, string, string][] = [
  ['Instruction encoding', 'Tiny: operands implicit, most opcodes 1 byte', 'Wider: every instruction names its registers'],
  ['Instructions executed', 'More — loads/stores to move values to the top', 'Fewer — operate on values where they are'],
  ['Interpreter dispatch cost', 'Paid more often (an indirect branch per opcode)', 'Paid less often'],
  ['Compiler (source → VM)', 'Trivial post-order walk', 'Needs register allocation'],
  ['Verification', 'Stack shape fixed per instruction → one-pass check', 'Check register types instead; similar effort'],
  ['JIT (VM → native)', 'Must rebuild data flow from the stack (cheap: it’s an SSA conversion anyway)', 'Data flow explicit, still re-allocated to real registers'],
];

const VMS = [
  { name: 'JVM', kind: 'stack', note: 'Portable, verifiable, compact class files (1995).' },
  { name: 'CPython', kind: 'stack', note: 'Simple compiler; the 3.11+ adaptive interpreter specialises opcodes.' },
  { name: 'WebAssembly', kind: 'stack', note: 'Structured stack code: small downloads and fast single-pass validation.' },
  { name: '.NET CIL', kind: 'stack', note: 'Always JIT- or AOT-compiled; never interpreted in production.' },
  { name: 'Dalvik / ART', kind: 'reg', note: 'Built for slow phone CPUs where the interpreter mattered.' },
  { name: 'Lua 5', kind: 'reg', note: 'Switched from stack to registers in 5.0 for interpreter speed.' },
  { name: 'BEAM (Erlang)', kind: 'reg', note: 'Register machine with X/Y registers.' },
  { name: 'V8 Ignition', kind: 'reg', note: 'Register machine with an implicit accumulator — a hybrid.' },
] as const;

export default function Page() {
  const [dispatch, setDispatch] = useState(6);
  const [perByte, setPerByte] = useState(1);

  const data = useMemo(
    () =>
      (Object.keys(PROGRAMS) as ProgramName[]).map((p) => {
        const a = [...PROGRAMS[p].defaults];
        const s = run(p, a);
        const r = runReg(p, a);
        const sm = simMethod(p);
        let sFetched = 0;
        for (const snap of s) {
          if (!snap.executed) continue;
          const m = simMethod(snap.executed.method);
          const nx = m.code[snap.executed.index + 1];
          sFetched += nx ? nx.offset - m.code[snap.executed.index].offset : 1;
        }
        const rs = r[r.length - 1].stats;
        return {
          p,
          args: a,
          sIns: s[s.length - 1].stats.instructions,
          rIns: rs.instructions,
          sSize: codeSize(sm),
          rSize: staticSize(REG_PROGRAMS[p]),
          sFetched,
          rFetched: rs.units * 2,
        };
      }),
    [],
  );

  const tot = data.reduce((t, d) => ({ sIns: t.sIns + d.sIns, rIns: t.rIns + d.rIns, sSize: t.sSize + d.sSize, rSize: t.rSize + d.rSize }), { sIns: 0, rIns: 0, sSize: 0, rSize: 0 });
  const cost = (ins: number, bytes: number) => ins * dispatch + bytes * perByte;

  return (
    <Slide lead="Neither design is “faster” in the abstract. It depends on whether you pay more for each dispatched instruction or for each byte you store, ship and decode.">
      <Grid cols="1.25fr 1fr" gap={16}>
        <Card title="Measured on the five Sim.java methods">
          <table className="to-table">
            <thead>
              <tr>
                <th>method</th>
                <th className="c-stack">executed</th>
                <th className="c-reg">executed</th>
                <th className="c-stack">size</th>
                <th className="c-reg">size</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.p}>
                  <td className="mono">
                    {d.p}({d.args.join(', ')})
                  </td>
                  <td>{d.sIns}</td>
                  <td>{d.rIns}</td>
                  <td>{d.sSize} B</td>
                  <td>{d.rSize} B</td>
                </tr>
              ))}
              <tr className="to-total">
                <td>total</td>
                <td>{tot.sIns}</td>
                <td>
                  {tot.rIns} <span className="faint">(−{Math.round((1 - tot.rIns / tot.sIns) * 100)}%)</span>
                </td>
                <td>{tot.sSize} B</td>
                <td>
                  {tot.rSize} B <span className="faint">({tot.rSize >= tot.sSize ? '+' : '−'}{Math.abs(Math.round((tot.rSize / tot.sSize - 1) * 100))}%)</span>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="faint small" style={{ marginTop: 10 }}>
            <span className="c-stack">■</span> stack (JVM) &nbsp; <span className="c-reg">■</span> register (Dalvik-style). A large study (Shi, Gregg, Beatty &
            Ertl, <i>Virtual Machine Showdown: Stack versus Registers</i>) found the same shape at scale: roughly half the executed instructions disappear, while code
            grows by about a quarter.
          </p>
        </Card>

        <Card title="Weigh it yourself">
          <label className="to-slider">
            <span>
              cost per <b>dispatched instruction</b> <b className="mono">{dispatch}</b>
            </span>
            <input type="range" min={0} max={20} value={dispatch} onChange={(e) => setDispatch(Number(e.target.value))} />
            <span className="faint small">interpreter loop overhead, branch mispredicts</span>
          </label>
          <label className="to-slider">
            <span>
              cost per <b>byte fetched</b> <b className="mono">{perByte}</b>
            </span>
            <input type="range" min={0} max={20} value={perByte} onChange={(e) => setPerByte(Number(e.target.value))} />
            <span className="faint small">memory, cache, download, decode</span>
          </label>
          <div className="to-verdicts">
            {data.map((d) => {
              const s = cost(d.sIns, d.sFetched);
              const r = cost(d.rIns, d.rFetched);
              const win = s === r ? 'tie' : s < r ? 'stack' : 'reg';
              return (
                <div key={d.p} className="to-verdict">
                  <span className="mono">{d.p}</span>
                  <Tag tone={win === 'stack' ? 'accent' : win === 'reg' ? 'blue' : 'muted'}>{win === 'tie' ? 'tie' : win === 'stack' ? 'stack wins' : 'register wins'}</Tag>
                  <span className="faint small mono">
                    {s} vs {r}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </Grid>

      <Card title="Design dimensions">
        <table className="to-table to-dims">
          <thead>
            <tr>
              <th />
              <th className="c-stack">Stack machine</th>
              <th className="c-reg">Register machine</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([k, s, r]) => (
              <tr key={k}>
                <td>{k}</td>
                <td>{s}</td>
                <td>{r}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="to-vms">
        {VMS.map((v) => (
          <div key={v.name} className={`to-vm k-${v.kind}`}>
            <div className="row">
              <b>{v.name}</b>
              <Tag tone={v.kind === 'stack' ? 'accent' : 'blue'}>{v.kind === 'stack' ? 'stack' : 'register'}</Tag>
            </div>
            <div className="muted small">{v.note}</div>
          </div>
        ))}
      </div>

      <Callout tone="green" title="Why the JVM can afford a stack">
        Hot code doesn’t stay as bytecode. The JIT converts the stack code into SSA form and allocates real CPU registers, so the stack exists only on
        paper — while the class files stay small, portable and quick to verify.
      </Callout>
    </Slide>
  );
}

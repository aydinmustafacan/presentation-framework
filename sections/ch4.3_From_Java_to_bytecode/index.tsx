import { useMemo, useState } from 'react';
import { Slide, Card, Code, Segmented, Tag } from '@framework';
import { CLASSES, formatIns, lineForOffset, JAVAC_VERSION, RELEASE, type Method } from '../_shared/bytecode.ts';
import './style.css';

const EXAMPLES: { cls: string; label: string; points: string[] }[] = [
  {
    cls: 'Hello',
    label: 'Hello',
    points: [
      '`System.out` is a static field: getstatic pushes the PrintStream reference.',
      'String concatenation is not StringBuilder any more: since Java 9 it is one invokedynamic to makeConcatWithConstants, linked at run time (JEP 280).',
      'println is an instance method → invokevirtual, receiver first, then arguments.',
    ],
  },
  {
    cls: 'Counter',
    label: 'Objects & fields',
    points: [
      '`count++` on a field is aload_0 · dup · getfield · iconst_1 · iadd · putfield — the dup keeps `this` for the putfield. Not atomic!',
      '`new Counter()` is three steps: new (allocate) · dup · invokespecial <init> (construct). The dup is the reference you keep.',
      'create() is static, so slot 0 is the local `o`, not `this`: aload_0 then invokevirtual increment().',
    ],
  },
  {
    cls: 'ArraySum',
    label: 'Loops & arrays',
    points: [
      'The enhanced for loop is sugar: javac copies the array and its length into hidden locals and loops with an index.',
      'iaload reads an element: arrayref, index → value, with a bounds check.',
      'The loop condition sits at the top and jumps out with if_icmpge; goto closes the loop.',
    ],
  },
  {
    cls: 'Switches',
    label: 'switch',
    points: [
      'Dense keys 1–4 → tableswitch: a jump table indexed by key − low. O(1).',
      'Sparse keys 200, 404, 5000 → lookupswitch: sorted key/target pairs, binary search.',
      'Both are padded so their 4-byte operands are aligned — look at the offsets jump from 1 to 32.',
    ],
  },
  {
    cls: 'Exceptions',
    label: 'try/catch/finally',
    points: [
      'There is no “try” instruction. Protection is described out-of-line in the exception table: [from, to) → handler.',
      'The finally block is copied into every exit path: normal return, the catch handler, and an “any” handler that rethrows.',
      'athrow at the end re-throws whatever the any-handler caught.',
    ],
  },
  {
    cls: 'Invocations',
    label: 'invoke*',
    points: [
      'All five invoke instructions in one method: invokespecial (constructor), invokevirtual (secret(), String.length), invokeinterface (List.add), invokestatic (Integer.valueOf, Math.max), invokedynamic (the lambda).',
      'Autoboxing is just a call to Integer.valueOf.',
      'The lambda body became a private static method lambda$calls$0; the captured `n` is passed as an argument.',
    ],
  },
  {
    cls: 'Wide',
    label: 'long & double',
    points: [
      'long and double take two local slots: a in 0–1, b in 2–3, count in 4, total in 5–6.',
      'They also take two operand-stack slots, so max_stack is larger than the number of values.',
      '`(double) total` becomes l2d; `count` is widened implicitly with i2d before ddiv. The JVM never mixes types in one instruction.',
    ],
  },
];

interface Row {
  method: Method;
  index: number; // -1 = header
}

export default function Page() {
  const [cls, setCls] = useState('Counter');
  const [hoverJava, setHoverJava] = useState<number | null>(null);
  const [hoverRow, setHoverRow] = useState<number | null>(null);
  const ex = EXAMPLES.find((e) => e.cls === cls)!;
  const data = CLASSES[cls];

  const { text, rows } = useMemo(() => {
    const rows: Row[] = [];
    const lines: string[] = [];
    for (const m of data.methods) {
      if (rows.length) {
        lines.push('');
        rows.push({ method: m, index: -2 });
      }
      lines.push(`// ${m.decl}`);
      rows.push({ method: m, index: -1 });
      m.code.forEach((ins, i) => {
        lines.push(formatIns(ins));
        rows.push({ method: m, index: i });
      });
    }
    return { text: lines.join('\n'), rows };
  }, [data]);

  const rowLine = (r: Row) => (r.index >= 0 ? lineForOffset(r.method, r.method.code[r.index].offset) : undefined);
  const hoveredRow = hoverRow !== null ? rows[hoverRow - 1] : undefined;
  const javaActive = hoverJava ?? (hoveredRow ? rowLine(hoveredRow) : undefined);
  const byteActive = rows.map((r, i) => (javaActive !== undefined && rowLine(r) === javaActive ? i + 1 : 0)).filter(Boolean);
  const focusMethod = hoveredRow?.method ?? (javaActive ? rows.find((r) => rowLine(r) === javaActive)?.method : undefined) ?? data.methods[data.methods.length > 1 ? 1 : 0];

  return (
    <Slide lead="Real javac output for everyday Java. Hover a source line to see the bytecode it became — or hover an instruction to find its source line (that mapping is the LineNumberTable).">
      <div className="row">
        <Segmented
          value={cls}
          onChange={(c) => {
            setCls(c);
            setHoverJava(null);
            setHoverRow(null);
          }}
          options={EXAMPLES.map((e) => ({ value: e.cls, label: e.label }))}
        />
        <span className="spacer" />
        <span className="faint small mono">
          {JAVAC_VERSION} --release {RELEASE} · javap -c
        </span>
      </div>

      <div className="jb-grid">
        <Card title={`${cls}.java`}>
          <Code
            code={data.source}
            lang="java"
            numbers
            active={javaActive}
            dim={javaActive !== undefined}
            onHoverLine={(l) => {
              setHoverRow(null);
              setHoverJava(l);
            }}
          />
        </Card>
        <Card title="Bytecode">
          <Code
            code={text}
            lang="jvm"
            active={byteActive}
            dim={javaActive !== undefined}
            onHoverLine={(l) => {
              setHoverJava(null);
              setHoverRow(l);
            }}
            className="jb-bytecode"
          />
        </Card>
      </div>

      <div className="jb-bottom">
        <Card title="What to notice" tone="accent">
          <ul className="jb-points">
            {ex.points.map((p, i) => (
              <li key={i}>{renderTicks(p)}</li>
            ))}
          </ul>
        </Card>
        <Card title={<span className="mono">{focusMethod.decl}</span>}>
          {focusMethod.locals.length > 0 && (
            <>
              <div className="w-label">LocalVariableTable</div>
              <table className="jb-table">
                <thead>
                  <tr>
                    <th>slot</th>
                    <th>name</th>
                    <th>type</th>
                    <th>live</th>
                  </tr>
                </thead>
                <tbody>
                  {[...focusMethod.locals]
                    .sort((a, b) => a.slot - b.slot)
                    .map((l) => (
                      <tr key={`${l.slot}-${l.name}`}>
                        <td>{l.slot}</td>
                        <td className="mono">{l.name}</td>
                        <td className="mono faint">{l.sig}</td>
                        <td className="mono faint">
                          {l.start}–{l.start + l.length}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </>
          )}
          {focusMethod.exceptions.length > 0 && (
            <>
              <div className="w-label" style={{ marginTop: 12 }}>
                Exception table
              </div>
              <table className="jb-table">
                <thead>
                  <tr>
                    <th>from</th>
                    <th>to</th>
                    <th>handler</th>
                    <th>type</th>
                  </tr>
                </thead>
                <tbody>
                  {focusMethod.exceptions.map((e, i) => (
                    <tr key={i}>
                      <td>{e.from}</td>
                      <td>{e.to}</td>
                      <td>{e.target}</td>
                      <td className="mono">{e.type === 'any' ? <Tag tone="red">any (finally)</Tag> : e.type.split('/').pop()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Card>
      </div>
    </Slide>
  );
}

function renderTicks(s: string) {
  return s.split(/(`[^`]+`)/).map((part, i) => (part.startsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part));
}

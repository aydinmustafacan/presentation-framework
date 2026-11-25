import { useMemo, useState } from 'react';
import { Card, Code, Segmented, Slide } from '@framework';
import { CLASSES, formatIns, lineForOffset, JAVAC_VERSION, RELEASE, type Method } from '../../../../sections/_shared/bytecode.ts';
import { SourceLinks } from '../_shared/ui.tsx';
import './style.css';

const EXAMPLES: { cls: string; label: string; points: string[] }[] = [
  {
    cls: 'Hello',
    label: 'Hello',
    points: [
      '`System.out` is a static field: getstatic pushes the PrintStream reference.',
      'String concatenation is one invokedynamic to makeConcatWithConstants, linked at run time (JEP 280).',
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
    cls: 'Invocations',
    label: 'Method calls',
    points: [
      'All five invoke instructions in one method: invokespecial (constructor), invokevirtual (secret(), String.length), invokeinterface (List.add), invokestatic (Integer.valueOf, Math.max), invokedynamic (the lambda).',
      'Autoboxing is just a call to Integer.valueOf.',
      'The lambda body became a private static method lambda$calls$0; the captured `n` is passed as an argument.',
    ],
  },
];

interface Row {
  method: Method;
  index: number; // -1 = method header, -2 = blank separator
}

export default function FromJavaToBytecode() {
  const [cls, setCls] = useState('Hello');
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

  return (
    <Slide lead="javac doesn’t produce machine code. It produces JVM bytecode, the format every runtime in this deck ultimately has to run on. Hover a source line to see what it became, or an instruction to find its source line.">
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
        <Card title={`${cls}.class · bytecode`}>
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

      <Card title="What to notice" tone="accent">
        <ul className="jb-points">
          {ex.points.map((p, i) => (
            <li key={i}>{renderTicks(p)}</li>
          ))}
        </ul>
      </Card>
      <p className="padded-note">
        Keep this format in mind: Jython compiles Python source into this same kind of bytecode. GraalPy instead interprets Python with a
        runtime that is itself JVM code, and JEP hands Python to native CPython over JNI.
      </p>
      <SourceLinks links={[['JVM specification · Instruction set', 'https://docs.oracle.com/javase/specs/jvms/se25/html/jvms-6.html']]} />
    </Slide>
  );
}

function renderTicks(s: string) {
  return s.split(/(`[^`]+`)/).map((part, i) => (part.startsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part));
}

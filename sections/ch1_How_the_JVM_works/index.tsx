import { useState } from 'react';
import { Slide, Code, Callout } from '@framework';
import './style.css';

const STAGES = [
  {
    id: 'src',
    title: 'Hello.java',
    kind: 'file',
    body: 'Source code written by you. Nothing about it is tied to a CPU or an operating system.',
    code: `class Hello {\n  static int add(int a, int b) {\n    return a + b;\n  }\n}`,
    lang: 'java' as const,
  },
  {
    id: 'javac',
    title: 'javac',
    kind: 'tool',
    body: 'The Java compiler parses, type-checks and lowers the program to bytecode. It does almost no optimisation — that is deliberately left to the JIT, which can see the running program.',
  },
  {
    id: 'class',
    title: 'Hello.class',
    kind: 'file',
    body: 'A binary class file: a constant pool, field and method tables, and each method body as a compact array of one-byte opcodes for a virtual stack machine.',
    code: `iload_0     // push a\niload_1     // push b\niadd        // pop 2, push a+b\nireturn     // return top of stack`,
    lang: 'jvm' as const,
  },
  {
    id: 'load',
    title: 'Class loader',
    kind: 'jvm',
    body: 'Finds the bytes (disk, jar, network, generated), defines the class, and links it: verify → prepare → resolve. Happens lazily, on first use.',
  },
  {
    id: 'verify',
    title: 'Verifier',
    kind: 'jvm',
    body: 'Proves the bytecode is type-safe before it runs: no stack underflow, no treating an int as a pointer, no jumping into the middle of an instruction. This is why untrusted bytecode can be loaded safely.',
  },
  {
    id: 'exec',
    title: 'Interpreter ⇄ JIT',
    kind: 'jvm',
    body: 'Every method starts out interpreted. Hot methods are compiled to native code by C1 (fast compile) and then C2 (heavily optimising), guided by profiles collected while interpreting.',
  },
  {
    id: 'cpu',
    title: 'x86-64 · ARM64 · …',
    kind: 'hw',
    body: 'The same .class file runs on any CPU with a JVM. The machine-specific work happens at the last possible moment — at run time.',
  },
];

export default function Cover() {
  const [active, setActive] = useState('class');
  const stage = STAGES.find((s) => s.id === active)!;

  return (
    <Slide
      title={
        <>
          Inside the <span className="hl">Java Virtual Machine</span>
        </>
      }
      lead="The JVM is an abstract computer with its own instruction set. Java compiles to that instruction set — bytecode — and the JVM turns it into real machine code while your program runs."
    >
      <div className="pipeline" role="tablist" aria-label="From source to CPU">
        {STAGES.map((s, i) => (
          <div className="pipe-cell" key={s.id}>
            {i > 0 && <div className="pipe-arrow" aria-hidden />}
            <button role="tab" aria-selected={s.id === active} className={`pipe-stage k-${s.kind} ${s.id === active ? 'is-on' : ''}`} onClick={() => setActive(s.id)} onMouseEnter={() => setActive(s.id)}>
              {s.title}
            </button>
          </div>
        ))}
      </div>
      <div className="pipe-bracket">
        <span>compile time</span>
        <span>run time — inside the JVM</span>
      </div>

      <div className="pipe-detail" key={stage.id}>
        <div>
          <h3>{stage.title}</h3>
          <p>{stage.body}</p>
        </div>
        {stage.code && <Code code={stage.code} lang={stage.lang} />}
      </div>

      <Callout title="What this deck covers">
        <b>1</b> the machine's architecture, class loading and the JIT · <b>2</b> how a stack machine executes bytecode, step by step · <b>3</b> stack vs register
        machines, measured on the same programs · <b>4</b> the class-file format and the instruction set, from real <code>javac</code> output.
      </Callout>
    </Slide>
  );
}

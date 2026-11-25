import { useState, type CSSProperties } from 'react';
import { Slide, Grid, Callout } from '@framework';
import { A, RT, RT_IDS, jythonJarBytes, type RtId } from '../_shared/alt.ts';
import { MB } from '../_shared/data.ts';
import { Note, Measured } from '../_shared/ui.tsx';
import './style.css';

type Kind = 'java' | 'py' | 'native' | 'jit';
interface Layer { name: string; sub: string; kind: Kind; text: string }

/** Top = your Java code, bottom = the machine. `py` layers are where Python semantics live. */
const STACKS: Record<RtId, Layer[]> = {
  jython: [
    { name: 'Your Java app', sub: 'PythonInterpreter', kind: 'java', text: 'Jython is one JAR on the classpath. new PythonInterpreter(), exec(), get(): that is the whole API surface, and it is plain Java objects all the way down.' },
    { name: 'Jython compiler', sub: '.py → JVM bytecode', kind: 'py', text: 'Jython compiles each Python module to JVM classes at load time. A Python function becomes a Java method; Python objects are Java objects (PyObject subclasses). There is no separate Python interpreter loop.' },
    { name: 'HotSpot JIT', sub: 'C1 / C2, any JDK', kind: 'jit', text: 'Because the Python code is now ordinary bytecode, the normal JVM JIT optimizes it on any JDK. That is why Jython’s hot loop is fast in 4.2 without GraalVM.' },
    { name: 'JVM only', sub: 'no native code, no GIL', kind: 'java', text: `Nothing native: one ${MB(jythonJarBytes, 0)} JAR runs anywhere Java runs. Threads are real JVM threads with no GIL. The price: the language is Python ${A.runtimes.jython.python}, and C extensions cannot load at all.` },
  ],
  jep: [
    { name: 'Your Java app', sub: 'SharedInterpreter / SubInterpreter', kind: 'java', text: 'jep.jar gives you interpreter objects with exec(), invoke(), getValue(). Each interpreter is bound to the Java thread that created it.' },
    { name: 'JNI bridge', sub: 'libjep (C)', kind: 'native', text: 'libjep is a small native library built by `pip install jep` against your JDK and your CPython. It converts arguments and wraps Java objects as PyJObject on the Python side.' },
    { name: 'CPython', sub: `libpython ${A.runtimes.jep.python}`, kind: 'py', text: 'The real reference interpreter, loaded into the JVM process. Same bytecode interpreter, same speed and same GIL as running python3 yourself.' },
    { name: 'C extensions', sub: 'numpy, pandas …', kind: 'native', text: 'Any wheel that works with that CPython works here: numpy imported and ran in the harness. Everything native has to be installed on the target machine: CPython, the packages, libjep.' },
  ],
  graalpy: [
    { name: 'Your Java app', sub: 'Context / Value', kind: 'java', text: 'The polyglot API from chapter 2: build a Context, eval Python, call functions as Values. Maven dependencies, no install on the target.' },
    { name: 'GraalPy', sub: 'interpreter in Java', kind: 'py', text: `A Python ${A.runtimes.graalpy.python} implementation written on Truffle: parser, bytecode compiler, self-specializing interpreter, builtins, and a C-API emulation layer for native extensions (chapter 1).` },
    { name: 'Graal JIT', sub: 'GraalVM JDK only', kind: 'jit', text: 'Partial evaluation turns hot Python functions into machine code, but only on a JVM that has the Graal compiler. On a stock OpenJDK GraalPy only interprets (1.4).' },
    { name: 'JVM + bundled natives', sub: 'in the JAR, 4 platforms', kind: 'native', text: 'Native helpers (POSIX, sqlite …) ship inside the JAR for four platforms and are extracted on first use. Your own C extensions need GraalPy builds (2.3).' },
  ],
};

const KIND_LABEL: Record<Kind, string> = { java: 'Java / JVM', py: 'where Python runs', native: 'native code', jit: 'JIT compiler' };

export default function Cover() {
  const [sel, setSel] = useState<[RtId, number]>(['jep', 2]);
  const layer = STACKS[sel[0]][sel[1]];
  return (
    <Slide
      title={<>GraalPy, <span className="t-jython">Jython</span> or <span className="t-jep">JEP</span>?</>}
      lead="GraalPy is not the first way to run Python from Java. Jython (born JPython) has done it since the late 1990s, and JEP embeds the real CPython. The three differ in one decision: where Python actually executes. That one choice sets the Python version, which packages load, how threads behave and how fast it runs. Click a layer."
    >
      <Grid cols={3} gap={16}>
        {RT_IDS.map((id) => (
          <div key={id} className="stack" style={{ '--rt': `var(--${RT[id].tone})` } as CSSProperties}>
            <div className="stack-head">
              <b>{RT[id].name}</b>
              <span className="faint small">{RT[id].how}</span>
            </div>
            {STACKS[id].map((l, i) => (
              <button
                key={l.name}
                className={`slayer k-${l.kind} ${sel[0] === id && sel[1] === i ? 'is-on' : ''}`}
                onMouseEnter={() => setSel([id, i])}
                onClick={() => setSel([id, i])}
              >
                <b>{l.name}</b>
                <span>{l.sub}</span>
              </button>
            ))}
            <div className="stack-foot mono small">{RT[id].version}</div>
          </div>
        ))}
      </Grid>
      <Note tone={layer.kind === 'java' ? 'blue' : layer.kind === 'jit' ? 'green' : layer.kind === 'py' ? 'accent' : undefined}>
        <b>{RT[sel[0]].name} · {layer.name}</b> <span className="faint small">({KIND_LABEL[layer.kind]})</span>. {layer.text.split('`').map((t, i) => (i % 2 ? <code key={i}>{t}</code> : t))}
      </Note>
      <div className="legend small muted">
        {(Object.keys(KIND_LABEL) as Kind[]).map((k) => <span key={k} className={`lg k-${k}`}>{KIND_LABEL[k]}</span>)}
      </div>
      <Callout title="This chapter">
        <b>4.1</b> the same Java→Python call written for all three · <b>4.2</b> startup, a hot loop and threads, measured with one harness · <b>4.3</b> which one fits your requirements.
      </Callout>
      <Measured>
        Versions in the stacks are the ones measured in decks/graalpy/example/alternatives (Jython {A.versions.jython}, JEP {A.versions.jep} with CPython {A.versions.cpython}, GraalPy {A.versions.graalpy}, all on {A.versions.jdk}).
      </Measured>
    </Slide>
  );
}

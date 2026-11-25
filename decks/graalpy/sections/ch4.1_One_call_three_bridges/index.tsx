import { useState, type CSSProperties } from 'react';
import { Slide, Grid, Card, Code, Callout } from '@framework';
import { A, RT, RT_IDS, pick, workloadPy, type RtId } from '../_shared/alt.ts';
import { lineOf } from '../_shared/sources.ts';
import { Note, Label, Measured } from '../_shared/ui.tsx';
import './style.css';

const J = RT.jython.source, P = RT.jep.source, G = RT.graalpy.source;

interface Step { id: string; title: string; code: Record<RtId, string>; notes: Record<RtId, string> }
const STEPS: Step[] = [
  {
    id: 'setup', title: 'Find the runtime',
    code: {
      jython: '// classpath: jython-standalone-2.7.4.jar, nothing else',
      jep: pick(P, 'MainInterpreter.setJepLibraryPath', 'JepConfig cfg = ', 'SharedInterpreter.setConfig(cfg)'),
      graalpy: '// classpath: org.graalvm.polyglot:polyglot + python-community\n// (here: the flask-jar fat JAR from chapter 3)',
    },
    notes: {
      jython: 'Everything, the standard library included, is inside one Maven artifact.',
      jep: 'JEP must be told where the native libjep is and where site-packages lives. Both come from `pip install jep` on this machine, built for this OS, CPU and CPython.',
      graalpy: 'Plain Maven dependencies. Python files come from the JAR (chapter 2.2 covers the virtual filesystem).',
    },
  },
  {
    id: 'create', title: 'Create an interpreter',
    code: {
      jython: pick(J, 'PythonInterpreter py = new PythonInterpreter();'),
      jep: pick(P, 'SharedInterpreter py = new SharedInterpreter();'),
      graalpy: pick(G, 'Engine engine = ', 'Context py = Context.newBuilder'),
    },
    notes: {
      jython: 'Cheap object, usable from any thread. All interpreters share the JVM and its JIT.',
      jep: 'A SharedInterpreter shares CPython’s main interpreter (and GIL) with all other SharedInterpreters. It may only be used by the thread that created it.',
      graalpy: 'allowAllAccess(true) is what lets Python call methods on Java objects (keySet() below). The Engine is optional; sharing it lets contexts share compiled code.',
    },
  },
  {
    id: 'load', title: 'Run Python source',
    code: { jython: pick(J, 'py.exec(src);'), jep: pick(P, 'py.exec(src);'), graalpy: pick(G, 'py.eval("python", src);') },
    notes: {
      jython: 'Compiles workload.py to JVM bytecode and runs it. The same file has to be valid Python 2.7 here.',
      jep: 'CPython compiles and runs it, exactly as python3 would.',
      graalpy: 'GraalPy parses it into its own bytecode, run by the Truffle interpreter.',
    },
  },
  {
    id: 'call', title: 'Call with Java arguments',
    code: {
      jython: pick(J, 'PyObject r = py.get("probe").__call__('),
      jep: pick(P, 'Object r = py.invoke("probe"'),
      graalpy: pick(G, 'Value r = g.getMember("probe").execute('),
    },
    notes: {
      jython: 'Arguments are wrapped explicitly with Py.java2py. Java objects stay Java objects; Python sees them through Jython’s Java integration.',
      jep: 'invoke() converts the arguments: String → str, arrays → PyJArray, other objects → PyJObject wrappers.',
      graalpy: 'execute() passes host objects through polyglot interop: the map arrives as a ForeignDict proxy, the byte[] as a ForeignList (same as 2.1).',
    },
  },
  {
    id: 'result', title: 'Read the result in Java',
    code: {
      jython: pick(J, 'for (PyObject e : ((PyTuple) r).getArray())'),
      jep: pick(P, 'put("probeElement0InJava"'),
      graalpy: pick(G, 'Value e = r.getArrayElement(i);'),
    },
    notes: {
      jython: `The tuple comes back as a ${A.runtimes.jython.probeReturnedToJava.split('.').pop()}, which also implements java.util.List; its get() converts elements to Java (element 0 is a ${A.runtimes.jython.probeElement0InJava}).`,
      jep: `JEP converts the whole tuple eagerly into a Java ${A.runtimes.jep.probeReturnedToJava.replace('java.util.', '')}: plain Java objects, no handle to Python left.`,
      graalpy: 'Nothing is converted until you ask: r and every element are polyglot Values that point into the Python heap.',
    },
  },
];

const ROWS = [
  { java: 'java.util.HashMap', i: 0 },
  { java: 'byte[] {104, 105}', i: 1 },
  { java: 'String "java string"', i: 2 },
] as const;

const probeLines = [lineOf(workloadPy, 'def probe('), lineOf(workloadPy, 'def probe(') + 1, lineOf(workloadPy, 'def probe(') + 2, lineOf(workloadPy, 'def probe(') + 3];
const probeSrc = workloadPy.split('\n').slice(probeLines[0] - 1, probeLines[3]).join('\n');

export default function Page() {
  const [cur, setCur] = useState('call');
  const s = STEPS.find((x) => x.id === cur)!;
  const [row, setRow] = useState<number | null>(null);
  return (
    <Slide lead="The same harness, written three times: create an interpreter, load workload.py, call probe(map, bytes, string) and read back the tuple it returns. The shape is the same everywhere. The difference is what actually crosses the boundary.">
      <Grid cols="220px 1fr" gap={14}>
        <div className="steps">
          {STEPS.map((x, i) => (
            <button key={x.id} className={`step ${cur === x.id ? 'is-on' : ''}`} onMouseEnter={() => setCur(x.id)} onClick={() => setCur(x.id)}>
              <span className="n">{i + 1}</span>{x.title}
            </button>
          ))}
        </div>
        <Grid cols={3} gap={12}>
          {RT_IDS.map((id) => (
            <Card key={id} className="rt" title={<span className="rt-name">{RT[id].name}</span>} style={{ '--rt': `var(--${RT[id].tone})` } as CSSProperties}>
              <Code code={s.code[id]} lang="java" />
              <div className="rt-note small">{s.notes[id].split('`').map((t, i) => (i % 2 ? <code key={i}>{t}</code> : t))}</div>
            </Card>
          ))}
        </Grid>
      </Grid>

      <Grid cols="minmax(0, 0.9fr) minmax(0, 1.6fr)" gap={16}>
        <div>
          <Label>workload.py: the function every harness calls</Label>
          <Code code={probeSrc} lang="py" active={row === null ? [] : [2]} dim={row !== null} />
        </div>
        <div>
          <Label>measured: type(arg).__name__ as Python sees it</Label>
          <table className="seen">
            <thead>
              <tr><th>Java passes</th>{RT_IDS.map((id) => <th key={id} style={{ '--rt': `var(--${RT[id].tone})` } as CSSProperties}>{RT[id].name}</th>)}</tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.i} onMouseEnter={() => setRow(r.i)} onMouseLeave={() => setRow(null)} className={row === r.i ? 'is-on' : ''}>
                  <td className="mono">{r.java}</td>
                  {RT_IDS.map((id) => <td key={id} className="mono"><b>{A.runtimes[id].probeSeenByPython[r.i]}</b></td>)}
                </tr>
              ))}
              <tr>
                <td>m.keySet() from Python</td>
                {RT_IDS.map((id) => <td key={id} className="mono">{A.runtimes[id].probeSeenByPython[3]}</td>)}
              </tr>
              <tr>
                <td>tuple returned to Java</td>
                {RT_IDS.map((id) => <td key={id} className="mono small">{A.runtimes[id].probeReturnedToJava.replace(/^(java\.util\.|org\.python\.core\.|org\.graalvm\.polyglot\.)/, '').replace(/ \(.*\)$/, '')}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </Grid>
      <Note tone="accent">
        <b>Read the String row.</b> Jython says <code>unicode</code> because it is Python 2: <code>str</code> there means bytes. All three let Python call <code>keySet()</code> on the Java map directly, and none copies it into a dict. The <code>byte[]</code> becomes three different things: Jython’s <code>array</code>, JEP’s <code>PyJArray</code> and GraalPy’s <code>ForeignList</code>.
      </Note>
      <Callout tone="muted" title="Not shown: Python calling into Java">
        All three can also import Java classes from Python (documented, not measured here): <code>from java.util import HashMap</code> in Jython and JEP, <code>import java</code> / <code>java.type(…)</code> in GraalPy (with host access allowed). Jython’s is the most seamless, since Python and Java objects share one object model.
      </Callout>
      <Measured>Output of JythonRun, JepRun and GraalPyRun in decks/graalpy/example/alternatives (code above is picked from those files).</Measured>
    </Slide>
  );
}

import { Code, Slide } from '@framework';
import { jythonDocs } from '../_shared/demo.ts';
import { Flow, SourceLinks } from '../_shared/ui.tsx';
// Real compiler output: regenerate with ../_shared/jython/generate.sh
import addPy from '../_shared/jython/add.py?raw';
import addJava from '../_shared/jython/Add.java?raw';
import pyBytecode from '../_shared/jython/python.javap.txt?raw';
import javaBytecode from '../_shared/jython/java.javap.txt?raw';
import './style.css';

const stages = [
  { label: 'Python 2.7 source', tone: 'guest' },
  { label: 'Jython compiler + runtime', tone: 'boundary' },
  { label: 'JVM bytecode', tone: 'artifact' },
  { label: 'Runs on the JVM', tone: 'artifact' },
] as const;

/** 1-based line of the first line containing `needle` (so the highlight follows regenerated output). */
const lineOf = (code: string, needle: string) => code.split('\n').findIndex((l) => l.includes(needle)) + 1;

const lanes = [
  {
    tone: 'guest', file: 'add.py', src: addPy, lang: 'py', compiler: 'jython',
    out: 'add$py.class', bytecode: pyBytecode, plus: lineOf(pyBytecode, 'PyObject._add'),
  },
  {
    tone: 'artifact', file: 'Add.java', src: addJava, lang: 'java', compiler: 'javac',
    out: 'Add.class', bytecode: javaBytecode, plus: lineOf(javaBytecode, 'iadd'),
  },
] as const;

const jvmParts = ['Class loader', 'Bytecode verifier', 'Interpreter + JIT', 'Garbage collector'];

export default function Jython() {
  return (
    <Slide lead="Jython compiles Python into Java bytecode, and that bytecode runs on the JVM like any other Java class. There is no separate Python interpreter underneath, and Python code can use Java classes directly.">
      <Flow stages={stages} />
      <div className="jy-illus">
        <div className="jy-lanes">
          {lanes.map((l) => (
            <div key={l.file} className={`jy-lane ${l.tone}`}>
              <div className="jy-file">{l.file}</div>
              <Code code={l.src} lang={l.lang} />
              <div className="jy-step">↓ <code>{l.compiler}</code> compiles</div>
              <div className="jy-file">{l.out} <span>javap -c</span></div>
              <Code code={l.bytecode} lang="jvm" active={l.plus} />
            </div>
          ))}
        </div>
        <div className="jy-merge" aria-hidden="true">↓ same kind of class file, same JVM ↓</div>
        <div className="jy-jvm">
          <b>JVM</b>
          {jvmParts.map((p) => <span key={p}>{p}</span>)}
        </div>
      </div>
      <p className="small-note">
        Real output of Jython 2.7.4 and javac 21. Both are ordinary JVM instructions. Java knows the types, so <code>a + b</code> becomes <code>iadd</code>. Python types are only known at run time, so Jython emits a call into its runtime library, <code>PyObject._add</code>, which the JIT then compiles like any other Java method.
      </p>
      <SourceLinks links={[
        ['Jython runtime', jythonDocs],
        ['Jython bytecode compilation', 'https://www.jython.org/jyspecific.html'],
      ]} />
    </Slide>
  );
}

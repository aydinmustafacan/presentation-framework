import { Slide } from '@framework';
import { jepDocs } from '../_shared/demo.ts';
import { Flow, SourceLinks, Surface } from '../_shared/ui.tsx';
import './style.css';

const milestones = [
  [1991, 'Guido van Rossum releases Python publicly. The original implementation, written in C, is now known as CPython.'],
  [1997, 'Jim Hugunin creates JPython, a JVM implementation of Python later renamed Jython.'],
  [2008, 'Python 3.0 is released. Modern Flask targets the Python 3 line.'],
] as const;

const jython = [
  { label: 'Java', tone: 'artifact' },
  { label: 'Jython', tone: 'guest' },
  { label: 'JVM bytecode', tone: 'artifact' },
] as const;

const jep = [
  { label: 'Java', tone: 'artifact' },
  { label: 'JNI / libjep', tone: 'boundary' },
  { label: 'CPython', tone: 'guest' },
] as const;

export default function PythonOrigins() {
  return (
    <Slide lead="Python is a language with multiple implementations. A Java service can run Python through a JVM implementation, such as Jython or the newer GraalPy (a Python 3 interpreter built on GraalVM’s Truffle framework), or embed CPython through a native bridge.">
      <ol className="python-timeline" aria-label="Python history">
        {milestones.map(([year, event]) => (
          <li key={year}>
            <strong>{year}</strong>
            <p>{event}</p>
          </li>
        ))}
      </ol>
      <div className="split python-paths">
        <Surface title="Jython runs Python on the JVM">
          <Flow stages={jython} />
          <p>Java calls Jython’s Java API. Jython compiles Python modules to JVM bytecode, which the JVM executes.</p>
        </Surface>
        <Surface title="JEP embeds CPython">
          <Flow stages={jep} />
          <p>The Java Native Interface (JNI) lets Java call native code. JEP’s native library, <code>libjep</code>, calls the CPython C API to run Python in the same process.</p>
        </Surface>
      </div>
      <p className="padded-note">The <strong>C API</strong> defines the functions native code can call. The <strong>application binary interface (ABI)</strong> is the compiled contract that the native library and CPython must agree on, including calling conventions and data layouts.</p>
      <SourceLinks links={[
        ['Python origins', 'https://docs.python.org/3/faq/general.html#why-was-python-created-in-the-first-place'],
        ['Jython history', 'https://www.jython.org/jython-old-sites/archive/22/history.html'],
        ['Jython bytecode', 'https://www.jython.org/jyspecific.html'],
        ['Python 3.0 release', 'https://www.python.org/download/releases/3.0/'],
        ['Java Native Interface', 'https://docs.oracle.com/en/java/javase/25/docs/specs/jni/intro.html'],
        ['CPython C API and ABI', 'https://docs.python.org/3/c-api/stable.html'],
        ['How JEP works', jepDocs],
      ]} />
    </Slide>
  );
}

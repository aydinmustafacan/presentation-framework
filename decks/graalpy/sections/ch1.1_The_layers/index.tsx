import { useState, type CSSProperties } from 'react';
import { Slide, Grid, Segmented, Tag } from '@framework';
import { M, MB } from '../_shared/data.ts';
import { Note, Measured } from '../_shared/ui.tsx';
import './style.css';

const cat = (id: string) => M.jar.categories.find((c) => c.id === id)!.compressed;

const LAYERS = [
  {
    id: 'app', name: 'Your Python code', tone: 'accent', jar: ['app', 'venv', 'pip'],
    items: ['app.py', 'Flask, Werkzeug, Jinja2 …', 'pip-installed at build time'],
    text: 'Ordinary Python. Nothing in app.py knows it runs on GraalPy, apart from the optional `import java` used by the /info route. Flask and its dependencies are pure Python, so they run unchanged.',
  },
  {
    id: 'graalpy', name: 'GraalPy', tone: 'accent', jar: ['graalpy', 'stdlib', 'capi', 'shadowed'],
    items: ['parser + bytecode compiler', 'interpreter (Truffle nodes)', 'builtins in Java: int, dict, str …', 'Python stdlib', 'C-API emulation'],
    text: 'The language implementation: about 19,000 class files in our JAR. Built-in types and many modules are written in Java (the compilation trace in 1.3 names ObjectBuiltins, DictBuiltins …), the rest of the standard library is the usual Python files, and a C-API layer lets native extensions load.',
  },
  {
    id: 'truffle', name: 'Truffle', tone: 'blue', jar: ['truffle', 'polyglot'],
    items: ['specializing-node DSL', 'polyglot API + interop', 'TRegex, NFI (native calls)', 'instruments: debugger, profiler'],
    text: 'A framework for writing language interpreters in Java. You write an interpreter whose nodes specialize themselves; Truffle supplies the polyglot API (Context, Value), interop between languages, a regex engine (GraalPy’s `re` uses TRegex), native calls, and tooling, plus the hooks that let Graal compile the interpreter.',
  },
  {
    id: 'graal', name: 'Graal JIT compiler', tone: 'green', jar: [],
    items: ['partial evaluation', 'speculation + deopt', 'from the GraalVM JDK, not the JAR'],
    text: 'Takes the interpreter plus one hot Python function and partially evaluates it into machine code. It is not in our JAR. A GraalVM JDK provides it. On a stock OpenJDK, Truffle prints “uses a fallback runtime that does not support runtime compilation” and everything stays interpreted (1.4 measures the cost).',
  },
  {
    id: 'host', name: 'Host VM', tone: 'blue', jar: [],
    items: ['HotSpot JVM (java -jar)', 'or Native Image (AOT binary)'],
    text: 'Either a normal JVM, which is what this deck uses, or GraalVM Native Image, which compiles the Java side (interpreter included) ahead of time into one executable. The native standalone `graalpy` launcher you can download is such an executable.',
  },
  {
    id: 'native', name: 'OS + native libraries', tone: 'muted', jar: ['native'],
    items: ['libposix, NFI glue', 'native stdlib modules (_sqlite3, pyexpat …)', 'for 4 platforms'],
    text: 'Some things need native code: POSIX calls, compression, sqlite, C extensions. GraalPy ships those libraries inside the JAR for Linux x64/arm64, macOS arm64 and Windows x64, and extracts the right set to a cache directory on first use.',
  },
] as const;

export default function Page() {
  const [sel, setSel] = useState<string>('graalpy');
  const [mode, setMode] = useState<'what' | 'jar'>('what');
  const layer = LAYERS.find((l) => l.id === sel)!;
  const size = (l: (typeof LAYERS)[number]) => l.jar.reduce((s, c) => s + cat(c), 0);
  const max = Math.max(...LAYERS.map(size));

  return (
    <Slide lead="GraalPy is not a wrapper around CPython. It is a stack: Python running on an interpreter written in Java, built on a framework that a JIT compiler knows how to optimize. Click a layer.">
      <div className="row">
        <Segmented value={mode} onChange={setMode} options={[{ value: 'what', label: 'What each layer does' }, { value: 'jar', label: 'Its share of our JAR' }]} />
      </div>
      <Grid cols="1.25fr 1fr" gap={20}>
        <div className="layers">
          {LAYERS.map((l) => (
            <button
              key={l.id}
              className={`layer ${sel === l.id ? 'is-on' : ''}`}
              style={{ '--c': `var(--${l.tone === 'muted' ? 'faint' : l.tone})` } as CSSProperties}
              onMouseEnter={() => setSel(l.id)}
              onClick={() => setSel(l.id)}
            >
              <span className="layer-name">{l.name}</span>
              {mode === 'what' ? (
                <span className="layer-items">{l.items.join(' · ')}</span>
              ) : (
                <span className="layer-size">
                  <span className="layer-bar" style={{ width: `${(size(l) / max) * 100}%` }} />
                  <b>{size(l) ? MB(size(l)) : 'not in the JAR'}</b>
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="col">
          <Note tone={layer.tone === 'blue' ? 'blue' : layer.tone === 'green' ? 'green' : 'accent'}>
            <b>{layer.name}.</b> {layer.text.split('`').map((t, i) => (i % 2 ? <code key={i}>{t}</code> : t))}
          </Note>
          {mode === 'jar' && (
            <div className="row">
              {layer.jar.length ? layer.jar.map((c) => <Tag key={c}>{M.jar.categories.find((x) => x.id === c)!.label}: {MB(cat(c))}</Tag>) : <Tag tone="muted">0 bytes in flask-jar-1.0.jar</Tag>}
            </div>
          )}
          {mode === 'jar' && <Measured>Compressed sizes inside the 84 MB fat JAR, grouped by package path. Section 3.2 breaks it down further.</Measured>}
        </div>
      </Grid>
    </Slide>
  );
}

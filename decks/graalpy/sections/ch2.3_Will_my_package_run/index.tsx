import { useState } from 'react';
import { Slide, Grid, Card, Segmented, Tag, Callout } from '@framework';
import { M, KB, MB } from '../_shared/data.ts';
import { Note, Measured, HBar } from '../_shared/ui.tsx';
import './style.css';

const pkgs = M.venv.packages;
const ver = (name: string) => M.venv.installed.find((p) => p.name.toLowerCase() === name)?.version ?? '';
const flaskStack = pkgs.filter((p) => p.name !== 'pip');
const pip = pkgs.find((p) => p.name === 'pip')!;
const maxB = Math.max(...flaskStack.map((p) => p.bytes));

const KINDS = {
  pure: {
    label: 'Pure Python', tone: 'green', examples: 'flask, werkzeug, jinja2, click, requests',
    text: 'Just .py files. GraalPy runs them like CPython does, as long as the stdlib modules they use exist (most do). They work on every platform the JAR runs on. The whole Flask stack is in this group.',
  },
  optional: {
    label: 'Pure Python + optional C speedups', tone: 'accent', examples: 'markupsafe, (simplejson, pyyaml …)',
    text: 'Ships a C accelerator but falls back to Python if it can’t load. In our build MarkupSafe has _speedups.c only as source, no compiled module, so it runs its pure-Python _native implementation. Correct output, somewhat slower.',
  },
  native: {
    label: 'C / C++ extension', tone: 'red', examples: 'numpy, psycopg2, lxml …',
    text: 'Needs a binary built against GraalPy’s C-API emulation, not CPython’s. The file names show the ABI is different: GraalPy’s own modules in the JAR are named like _sqlite3.graalpy250-312-native-aarch64-darwin.so, where CPython uses .cpython-312-darwin.so. pip has to get a GraalPy build or compile from source, and that binary only runs on the OS/CPU it was built for.',
  },
  rust: {
    label: 'Rust (PyO3) extension', tone: 'red', examples: 'pydantic-core, orjson, cryptography …',
    text: 'Same as C extensions from GraalPy’s point of view: native code calling the C-API, so it needs a build for GraalPy and the target platform. Check upstream support before relying on one.',
  },
} as const;
type Kind = keyof typeof KINDS;

export default function Page() {
  const [kind, setKind] = useState<Kind>('pure');
  const k = KINDS[kind];
  const venvTotal = pkgs.reduce((s, p) => s + p.bytes, 0);

  return (
    <Slide lead="GraalPy implements the Python language and most of the standard library, so the compatibility question is almost always about native code. Pure-Python packages just run. Anything with a compiled extension needs a build made for GraalPy.">
      <Grid cols="1fr 1fr" gap={18}>
        <Card title={<>what <code>pip install flask=={M.versions.flask}</code> put in the JAR</>}>
          <div className="pk-list">
            {flaskStack.map((p) => (
              <div key={p.name} className="pk" onMouseEnter={() => setKind(p.cSources.length ? 'optional' : 'pure')}>
                <span className="pk-name">{p.name} <span className="faint">{ver(p.name)}</span></span>
                <HBar value={p.bytes} max={maxB} tone={p.cSources.length ? 'accent' : 'green'} label={KB(p.bytes)} />
                {p.cSources.length ? <Tag tone="accent">{p.cSources.join(', ')} not built</Tag> : <Tag tone="green">pure</Tag>}
              </div>
            ))}
          </div>
          <div className="pip-note small muted">
            plus <b>pip {ver('pip')}</b>: {MB(pip.bytes)}, {Math.round((pip.bytes / venvTotal) * 100)}% of the venv. The plugin uses it at build time; the app never imports it.
          </div>
        </Card>
        <div className="col">
          <Segmented value={kind} onChange={setKind} options={(Object.keys(KINDS) as Kind[]).map((id) => ({ value: id, label: KINDS[id].label }))} />
          <Note tone={k.tone === 'green' ? 'green' : k.tone === 'accent' ? 'accent' : 'red'}>
            <b>{k.label}.</b> {k.text}
            <div className="ex small faint">e.g. {k.examples}</div>
          </Note>
          <Callout tone="blue" title="Why it matters for one JAR">
            A pure-Python app makes a JAR that runs anywhere there is a JVM: our Flask JAR includes GraalPy’s own native libraries for four platforms and nothing platform-specific of ours. Add one C extension and the JAR works only on the platform it was built on, unless you build and bundle it for each.
          </Callout>
          <Note>
            During the build the plugin logged <code>Falling back to bundled GraalPy patch repository</code>. GraalPy keeps patches for popular packages that need small changes to build or run, and pip applies them automatically when it installs those versions.
          </Note>
        </div>
      </Grid>
      <Measured>Package list and sizes from the venv inside the example JAR. Example packages per category are classifications only; they were not tested here.</Measured>
    </Slide>
  );
}

import { useState } from 'react';
import { Slide, Grid, Card, Segmented, Tag, Code } from '@framework';
import { M } from '../_shared/data.ts';
import { Note, Label, Measured } from '../_shared/ui.tsx';
import './style.css';

interface Where { sys_path: string[]; prefix: string; executable: string; flask: string; json: string; app: string; markupsafe_escape: string; os_name: string; platform: string }
const W: Where = JSON.parse(M.responses.where);
const short = (p: string) => p.replace(/python-home\/([0-9a-f]{6})[0-9a-f]+/, 'python-home/$1…');

const PATHS = W.sys_path.map((p) => ({
  path: p,
  kind: p.startsWith('/graalpy_vfs/src') ? 'src' : p.startsWith('/graalpy_vfs') ? 'venv' : p.endsWith('/modules') ? 'native' : 'stdlib',
}));
const KIND = {
  src: { label: 'your code', where: 'in the JAR', jar: 'org.graalvm.python.vfs/src/' },
  stdlib: { label: 'standard library', where: 'extracted to a cache dir', jar: 'META-INF/resources/libpython/' },
  native: { label: 'GraalPy native modules', where: 'extracted to a cache dir', jar: 'META-INF/resources/<os>/<arch>/lib/graalpy25.0/modules/' },
  venv: { label: 'pip packages', where: 'in the JAR', jar: 'org.graalvm.python.vfs/venv/lib/python3.12/site-packages/' },
} as const;

const MODULES = [
  { name: 'app', found: 'src', file: W.app, note: 'sys.path[0] is the src folder inside the JAR, so your own modules shadow everything else, like the script directory does in CPython.' },
  { name: 'sys', found: 'builtin', file: '(built-in, implemented in Java)', note: 'Built-in modules are found by BuiltinImporter on sys.meta_path before sys.path is even consulted (sys.__spec__.origin is “built-in”). In GraalPy they are Java code inside the interpreter. The last finder, JavaImportFinder, is GraalPy’s own: it lets Python import Java packages.' },
  { name: 'json', found: 'stdlib', file: W.json, note: 'The standard library is in the JAR too, but GraalPy unpacks it once into a per-user cache directory keyed by a content hash, and imports it from real files there. Later starts reuse the unpacked copy.' },
  { name: 'flask', found: 'venv', file: W.flask, note: 'site-packages is last on sys.path. It is the venv the Maven plugin created and pip-installed into at build time, now read straight out of the JAR through the virtual filesystem.' },
  { name: 'markupsafe._speedups', found: 'none', file: 'not found → markupsafe uses markupsafe._native', note: `MarkupSafe ships _speedups.c as source but the build produced no compiled module, so its import fails and MarkupSafe falls back to pure Python. Live check from the JAR: escape() is implemented in ${W.markupsafe_escape}.` },
] as const;

export default function Page() {
  const [mod, setMod] = useState<string>('json');
  const m = MODULES.find((x) => x.name === mod)!;
  const hit = PATHS.findIndex((p) => p.kind === m.found);

  return (
    <Slide lead="Python expects files and directories. A JAR is a zip of resources. GraalPy bridges the two with a virtual filesystem: inside Python, the JAR’s resources appear as a read-only tree under /graalpy_vfs, so import, open() and os.listdir() work unchanged. Writing there fails with PermissionError.">
      <div className="row">
        <span className="muted small">import</span>
        <Segmented value={mod} onChange={setMod} options={MODULES.map((x) => ({ value: x.name, label: <code>{x.name}</code> }))} />
      </div>
      <Grid cols="1.3fr 1fr" gap={18}>
        <Card title="sys.path inside the running JAR (real)">
          <div className="meta-row">
            <span className={`sp ${m.found === 'builtin' ? 'is-hit' : ''}`}>sys.meta_path → PipImportHook, BuiltinImporter, FrozenImporter, PathFinder (walks sys.path ↓), JavaImportFinder</span>
          </div>
          {PATHS.map((p, i) => {
            const state = m.found === 'builtin' ? 'is-skip' : i === hit ? 'is-hit' : hit === -1 || i < hit ? 'is-miss' : 'is-skip';
            return (
              <div key={i} className={`sp k-${p.kind} ${state}`}>
                <span className="sp-i">[{i}]</span>
                <span className="sp-path">{short(p.path)}</span>
                <Tag tone={KIND[p.kind as keyof typeof KIND].where === 'in the JAR' ? 'accent' : 'blue'}>{KIND[p.kind as keyof typeof KIND].where}</Tag>
              </div>
            );
          })}
          <div className="resolved mono">→ {short(m.file)}</div>
        </Card>
        <div className="col">
          <Note tone={m.found === 'none' ? 'red' : 'accent'}><b>import {m.name}.</b> {m.note}</Note>
          {hit >= 0 && (
            <div>
              <Label>same file, as stored in the JAR</Label>
              <Code code={KIND[PATHS[hit].kind as keyof typeof KIND].jar + (m.name === 'json' ? 'json/__init__.py' : m.name === 'flask' ? 'flask/__init__.py' : 'app.py')} lang="text" />
            </div>
          )}
          <Grid cols={2} gap={8}>
            <div className="kv"><span>sys.prefix</span><code>{W.prefix}</code></div>
            <div className="kv"><span>sys.executable</span><code>{W.executable}</code></div>
            <div className="kv"><span>os.name / sys.platform</span><code>{W.os_name} / {W.platform}</code></div>
            <div className="kv"><span>files in the VFS</span><code>{M.venv.vfsFiles.toLocaleString()} (fileslist.txt)</code></div>
          </Grid>
        </div>
      </Grid>
      <Note>
        <b>Two kinds of “in the JAR”.</b> Your code and pip packages live under <code>org.graalvm.python.vfs/</code> and are read through the VFS on every import. GraalPy’s own language home (the stdlib and native modules) lives under <code>META-INF/resources/</code> and is unpacked once to <code>~/Library/Caches/org.graalvm.polyglot/</code> (on macOS) because native libraries have to be real files to be loaded.
      </Note>
      <Measured>sys.path, file locations and the MarkupSafe check come from the /where route of the example app, served from the JAR; meta_path and the read-only check from snippets/VfsCheck.java. Home directory shortened to ~.</Measured>
    </Slide>
  );
}

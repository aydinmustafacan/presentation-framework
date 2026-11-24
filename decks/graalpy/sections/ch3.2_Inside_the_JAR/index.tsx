import { useState, type CSSProperties } from 'react';
import { Slide, Grid, Card, Segmented, Stat } from '@framework';
import { M, MB, KB } from '../_shared/data.ts';
import { Note, Measured, HBar } from '../_shared/ui.tsx';
import './style.css';

const COLOR: Record<string, string> = {
  app: 'var(--accent)', venv: 'color-mix(in srgb, var(--accent) 60%, var(--panel))', pip: 'color-mix(in srgb, var(--accent) 30%, var(--panel))',
  graalpy: 'var(--blue)', stdlib: 'color-mix(in srgb, var(--blue) 60%, var(--panel))', capi: 'color-mix(in srgb, var(--blue) 35%, var(--panel))',
  native: 'var(--red)', truffle: 'var(--violet)', polyglot: 'color-mix(in srgb, var(--violet) 55%, var(--panel))',
  shadowed: 'var(--teal)', other: 'var(--border-strong)',
};
const WHY: Record<string, string> = {
  app: 'Everything you wrote: two Python files and one class. Under 0.01% of the JAR.',
  venv: 'The Flask stack from pip, as plain .py files (plus a few templates and metadata).',
  pip: 'pip itself, left in the venv by the build. Nothing imports it at run time.',
  graalpy: 'The Python implementation: parser, bytecode compiler and interpreter, plus builtins and many modules written in Java. Truffle’s DSL generates a class for every specializing node: the JAR holds 8,078 generated …NodeGen classes.',
  stdlib: 'The Python standard library as .py files, unpacked to a cache directory on first run (2.2).',
  capi: 'Headers, C-API support code and GraalPy’s package patches: what native extensions and pip need.',
  native: 'Native libraries for linux/amd64, linux/aarch64, darwin/aarch64 and windows/amd64, so the same JAR runs on all four. At run time only the current platform’s set is extracted (checked: the cache holds only darwin libraries).',
  truffle: 'The language framework: API, polyglot implementation, TRegex, native-call interface (NFI) and the runtime that drives compilation.',
  shadowed: 'Libraries GraalPy depends on, relocated to org.graalvm.shadowed to avoid clashes with your own versions: mostly ICU4J (Unicode data), also XZ, JLine and a JSON parser.',
  polyglot: 'org.graalvm.polyglot: Context, Value, Engine, the API Main.java uses.',
  other: 'Manifest, Maven metadata, multi-release class variants.',
};

export default function Page() {
  const [mode, setMode] = useState<'compressed' | 'bytes'>('compressed');
  const [sel, setSel] = useState('graalpy');
  const cats = [...M.jar.categories].sort((a, b) => b[mode] - a[mode]);
  const total = cats.reduce((s, c) => s + c[mode], 0);
  const c = M.jar.categories.find((x) => x.id === sel)!;
  const mine = ['app', 'venv', 'pip'].reduce((s, id) => s + M.jar.categories.find((x) => x.id === id)!.compressed, 0);

  return (
    <Slide lead={`flask-jar-1.0.jar is ${MB(M.jar.size)}. The Flask app is a few kilobytes; the rest is a complete Python implementation and the framework it runs on. Hover the bar or the list.`}>
      <div className="row">
        <Segmented value={mode} onChange={setMode} options={[{ value: 'compressed', label: 'Size in the JAR (compressed)' }, { value: 'bytes', label: 'Unpacked size' }]} />
        <span className="spacer" />
        <span className="muted mono small">{mode === 'compressed' ? <>file data {MB(total)} + ZIP headers {MB(M.jar.size - total)} = {MB(M.jar.size)}</> : <>unpacked {MB(total)}</>} · {M.jar.files.toLocaleString()} files</span>
      </div>
      <div className="stack">
        {cats.map((x) => (
          <div key={x.id} className={`seg ${sel === x.id ? 'is-on' : ''}`} style={{ width: `${(x[mode] / total) * 100}%`, '--c': COLOR[x.id] } as CSSProperties} onMouseEnter={() => setSel(x.id)} title={x.label}>
            {x[mode] / total > 0.07 && <span>{x.label}</span>}
          </div>
        ))}
      </div>
      <Grid cols="1.1fr 1fr" gap={18}>
        <Card>
          <div className="cats">
            {cats.map((x) => (
              <div key={x.id} className={`cat-row ${sel === x.id ? 'is-on' : ''}`} onMouseEnter={() => setSel(x.id)}>
                <span className="sw" style={{ background: COLOR[x.id] }} />
                <span className="cat-label">{x.label}</span>
                <HBar value={x[mode]} max={cats[0][mode]} tone="faint" label={KB(x[mode])} />
                <span className="faint mono small">{((x[mode] / total) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </Card>
        <div className="col">
          <Note tone="accent">
            <b>{c.label}</b> · {KB(c.compressed)} in the JAR, {KB(c.bytes)} unpacked, {c.files.toLocaleString()} files
            <div className="detail">{WHY[c.id]}</div>
            <div className="faint small">{c.detail}</div>
          </Note>
          <Grid cols={2} gap={10}>
            <Stat label="your Python (app + venv + pip)" value={MB(mine)} tone="accent" hint={`${((mine / M.jar.size) * 100).toFixed(0)}% of the JAR`} />
            <Stat label="GraalPy + Truffle + deps" value={MB(M.jar.size - mine)} tone="blue" hint="the same for every app" />
          </Grid>
          <Note>
            The big part is fixed cost: a second Flask app would produce an almost identical JAR. If you deploy to one platform only, the native libraries for the other three and the unused pip are the obvious things to trim. That is not tried here.
          </Note>
        </div>
      </Grid>
      <Measured>Every file in the fat JAR, grouped by path prefix (zipinfo). Categories are defined in example/collect.mjs. The ~9 MB not in the bar is ZIP bookkeeping: a local and a central header per entry, ×33,222 entries (checked: data + headers add up to the file size).</Measured>
    </Slide>
  );
}

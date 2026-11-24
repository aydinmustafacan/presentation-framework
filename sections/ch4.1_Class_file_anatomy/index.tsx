import { useMemo, useState, type CSSProperties, type DragEvent } from 'react';
import { Slide, Card, Code, Segmented, Tag, Button } from '@framework';
import { CLASSES } from '../_shared/bytecode.ts';
import { parseClass, base64ToBytes, type Region, type Group } from '../_shared/classfile.ts';
import './style.css';

const GROUPS: Record<Group, { label: string; color: string }> = {
  header: { label: 'Header', color: '#f29e4c' },
  cp: { label: 'Constant pool', color: '#4fd1c5' },
  class: { label: 'Class info', color: '#b493ff' },
  field: { label: 'Fields', color: '#79c0ff' },
  method: { label: 'Methods', color: '#5fd08f' },
  attr: { label: 'Attributes', color: '#8b93a3' },
  code: { label: 'Bytecode', color: '#ffd580' },
};

const SAMPLES = ['Point', 'Hello', 'Switches'] as const;

export default function Page() {
  const [sample, setSample] = useState<string>('Point');
  const [custom, setCustom] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [hover, setHover] = useState<Region | null>(null);
  const [pinned, setPinned] = useState<Region | null>(null);
  const [dragging, setDragging] = useState(false);

  const bytes = useMemo(() => custom?.bytes ?? base64ToBytes(CLASSES[sample].classFile), [custom, sample]);
  const parsed = useMemo(() => {
    try {
      return { ok: parseClass(bytes), err: null };
    } catch (e) {
      return { ok: null, err: (e as Error).message };
    }
  }, [bytes]);

  const regionAt = useMemo(() => {
    const arr: (Region | undefined)[] = new Array(bytes.length);
    if (parsed.ok) for (const r of parsed.ok.regions) for (let i = r.start; i < r.end; i++) arr[i] = r;
    return arr;
  }, [parsed, bytes]);

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (!f) return;
    setCustom({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
    setPinned(null);
  };

  const focus = hover ?? pinned;
  const rows = Math.ceil(bytes.length / 16);
  const source = custom ? null : CLASSES[sample].source;

  return (
    <Slide lead="A .class file is a flat byte array with a strict layout. Hover any byte to see which structure it belongs to — or drop your own .class file onto the hex view.">
      <div className="row">
        <Segmented
          value={custom ? '__custom' : sample}
          onChange={(v) => {
            if (v === '__custom') return;
            setCustom(null);
            setSample(v);
            setPinned(null);
          }}
          options={[...SAMPLES.map((s) => ({ value: s as string, label: `${s}.class` })), ...(custom ? [{ value: '__custom', label: custom.name }] : [])]}
        />
        <span className="spacer" />
        <div className="legend">
          {Object.entries(GROUPS).map(([k, g]) => (
            <span key={k}>
              <i style={{ background: g.color }} />
              {g.label}
            </span>
          ))}
        </div>
      </div>

      {!parsed.ok ? (
        <Card tone="red" title="Could not parse">
          {parsed.err}{' '}
          <Button variant="ghost" onClick={() => setCustom(null)}>
            back to samples
          </Button>
        </Card>
      ) : (
        <div className="cf-grid">
          <div
            className={`hex ${dragging ? 'is-drop' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onMouseLeave={() => setHover(null)}
          >
            {Array.from({ length: rows }, (_, row) => (
              <div className="hex-row" key={row}>
                <span className="hex-off">{(row * 16).toString(16).padStart(4, '0')}</span>
                <span className="hex-bytes">
                  {Array.from({ length: 16 }, (_, k) => {
                    const i = row * 16 + k;
                    if (i >= bytes.length) return <span key={k} className="hb is-pad" />;
                    const r = regionAt[i];
                    const on = focus && r === focus;
                    return (
                      <span
                        key={k}
                        className={`hb ${on ? 'is-on' : ''}`}
                        style={{ '--c': r ? GROUPS[r.group].color : 'var(--faint)' } as CSSProperties}
                        onMouseEnter={() => setHover(r ?? null)}
                        onClick={() => setPinned(r ?? null)}
                      >
                        {bytes[i].toString(16).padStart(2, '0')}
                      </span>
                    );
                  })}
                </span>
                <span className="hex-ascii">
                  {Array.from(bytes.subarray(row * 16, row * 16 + 16), (b, k) => {
                    const r = regionAt[row * 16 + k];
                    return (
                      <span key={k} className={focus && r === focus ? 'is-on' : ''}>
                        {b >= 32 && b < 127 ? String.fromCharCode(b) : '·'}
                      </span>
                    );
                  })}
                </span>
              </div>
            ))}
            {dragging && <div className="drop-hint">Drop a .class file</div>}
          </div>

          <div className="cf-side">
            <Card title="This byte range">
              {focus ? (
                <div className="focus" key={`${focus.start}`}>
                  <div className="focus-path">
                    {focus.path.map((p, i) => (
                      <span key={i}>{p}</span>
                    ))}
                  </div>
                  <div className="focus-label mono" style={{ '--c': GROUPS[focus.group].color } as CSSProperties}>
                    {focus.label}
                  </div>
                  {focus.value && <div className="focus-value mono">{focus.value}</div>}
                  <div className="faint small mono">
                    bytes {focus.start}–{focus.end - 1} ({focus.end - focus.start} B)
                  </div>
                </div>
              ) : (
                <div className="muted">
                  Hover the hex. Start with the first four bytes: <code>CA FE BA BE</code>.
                </div>
              )}
            </Card>
            <Card title="Summary">
              <dl className="summary">
                <dt>class</dt>
                <dd className="mono">{parsed.ok.thisClass}</dd>
                <dt>extends</dt>
                <dd className="mono">{parsed.ok.superClass}</dd>
                <dt>version</dt>
                <dd>
                  {parsed.ok.version.major}.{parsed.ok.version.minor} <Tag>{parsed.ok.version.java}</Tag>
                </dd>
                <dt>constants</dt>
                <dd>{parsed.ok.constants.length} entries</dd>
                <dt>size</dt>
                <dd>{bytes.length} bytes</dd>
              </dl>
              <div className="methods">
                {parsed.ok.methods.map((m) => (
                  <div key={m.name + m.descriptor} className="method">
                    <div className="mono small">
                      <b>{m.name}</b>
                      <span className="faint">{m.descriptor}</span>
                    </div>
                    <div className="faint small">
                      max_stack {m.maxStack ?? '—'} · max_locals {m.maxLocals ?? '—'} · {m.code.length} instructions
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            {source && (
              <Card title={`${sample}.java`}>
                <Code code={source} lang="java" style={{ maxHeight: 220 }} />
              </Card>
            )}
          </div>
        </div>
      )}
    </Slide>
  );
}

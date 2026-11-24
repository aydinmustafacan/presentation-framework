import { useMemo, useState, type CSSProperties } from 'react';
import { Slide, Card, Tag, Callout } from '@framework';
import { OPCODES, BY_CODE, CATEGORY_INFO, fixedLength, type Category, type Opcode } from '../_shared/opcodes.ts';
import { CLASSES } from '../_shared/bytecode.ts';
import './style.css';

const OPERAND_TEXT: Record<string, string> = {
  b: 'signed byte',
  B: 'unsigned byte',
  s: 'signed short',
  S: 'constant-pool index (u2)',
  o: 'branch offset (s2)',
  O: 'branch offset (s4)',
  '0': 'zero byte',
};

/** How often each opcode appears in the javac output used in this deck. */
function usage() {
  const n = new Map<string, number>();
  for (const c of Object.values(CLASSES)) for (const m of c.methods) for (const i of m.code) n.set(i.op, (n.get(i.op) ?? 0) + 1);
  return n;
}

export default function Page() {
  const [sel, setSel] = useState<Opcode>(BY_CODE.get(0x60)!);
  const [cat, setCat] = useState<Category | null>(null);
  const [q, setQ] = useState('');
  const [onlyUsed, setOnlyUsed] = useState(false);
  const used = useMemo(usage, []);

  const matches = (o: Opcode) =>
    (!cat || o.category === cat) && (!q || o.name.includes(q.toLowerCase()) || o.desc.toLowerCase().includes(q.toLowerCase())) && (!onlyUsed || used.has(o.name));

  const typed = useMemo(() => {
    const prefixes = { i: 0, l: 0, f: 0, d: 0, a: 0 };
    for (const o of OPCODES) {
      const p = o.name[0] as keyof typeof prefixes;
      if (p in prefixes && /^[ilfda](load|store|add|sub|mul|div|rem|neg|return|const|aload|astore|2|cmp|and|or|xor|sh|ush|inc)/.test(o.name)) prefixes[p]++;
    }
    return prefixes;
  }, []);

  const cnt = OPCODES.filter((o) => o.category !== 'reserved').length;

  return (
    <Slide lead={`One byte per opcode means at most 256 instructions. The JVM defines ${cnt}, plus 3 reserved. Types are spelled out in the opcode name — iadd, ladd, fadd, dadd — so the verifier and interpreter never have to guess.`}>
      <div className="row">
        <input className="text-input is-search" placeholder="search: invoke, return, array…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="cats">
          {(Object.keys(CATEGORY_INFO) as Category[]).map((c) => (
            <button key={c} className={`cat ${cat === c ? 'is-on' : ''}`} style={{ '--c': CATEGORY_INFO[c].color } as CSSProperties} onClick={() => setCat(cat === c ? null : c)}>
              {CATEGORY_INFO[c].label}
            </button>
          ))}
          <label className="used-toggle">
            <input type="checkbox" checked={onlyUsed} onChange={(e) => setOnlyUsed(e.target.checked)} /> only ones javac emitted in this deck
          </label>
        </div>
      </div>

      <div className="is-grid">
        <div className="opmap" role="grid" aria-label="Opcode map">
          <div className="opmap-corner" />
          {Array.from({ length: 16 }, (_, c) => (
            <div key={c} className="opmap-head">
              _{c.toString(16).toUpperCase()}
            </div>
          ))}
          {Array.from({ length: 16 }, (_, r) => (
            <div key={r} className="opmap-rowwrap">
              <div className="opmap-head">{r.toString(16).toUpperCase()}_</div>
              {Array.from({ length: 16 }, (_, c) => {
                const code = r * 16 + c;
                const o = BY_CODE.get(code);
                if (!o) return <div key={c} className="op is-free" title={`0x${code.toString(16)} — unassigned`} />;
                const on = matches(o);
                return (
                  <button
                    key={c}
                    className={`op ${on ? '' : 'is-dim'} ${sel.code === code ? 'is-sel' : ''} ${used.has(o.name) ? 'is-used' : ''}`}
                    style={{ '--c': CATEGORY_INFO[o.category].color } as CSSProperties}
                    onClick={() => setSel(o)}
                    onMouseEnter={() => setSel(o)}
                    title={o.name}
                  >
                    {o.name}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="is-side">
          <Card title="Instruction" key={sel.code}>
            <div className="op-name mono" style={{ '--c': CATEGORY_INFO[sel.category].color } as CSSProperties}>
              {sel.name}
            </div>
            <div className="row" style={{ margin: '6px 0 12px' }}>
              <Tag>0x{sel.code.toString(16).padStart(2, '0').toUpperCase()}</Tag>
              <Tag>{sel.code}</Tag>
              <Tag tone="violet">{sel.operands === '*' ? 'variable length' : `${fixedLength(sel)} byte${fixedLength(sel) > 1 ? 's' : ''}`}</Tag>
              {used.has(sel.name) && <Tag tone="green">used {used.get(sel.name)}× in this deck</Tag>}
            </div>
            <p>{sel.desc}</p>
            {sel.stack && (
              <div className="stack-effect">
                <span className="faint small">operand stack</span>
                <code>…, {sel.stack}</code>
              </div>
            )}
            {sel.operands && sel.operands !== '*' && (
              <div className="encoding">
                <span className="enc-byte is-op">{sel.code.toString(16).padStart(2, '0')}</span>
                {[...sel.operands].map((c, i) => (
                  <span key={i} className={`enc-byte w-${c === 'S' || c === 's' || c === 'o' ? 2 : c === 'O' ? 4 : 1}`} title={OPERAND_TEXT[c]}>
                    {OPERAND_TEXT[c]}
                  </span>
                ))}
              </div>
            )}
          </Card>
          <Card title={CATEGORY_INFO[sel.category].label}>
            <p className="muted small">{CATEGORY_INFO[sel.category].blurb}</p>
          </Card>
          <Card title="Typed families">
            <div className="families">
              {Object.entries(typed).map(([p, n]) => (
                <div key={p}>
                  <b className="mono">{p}</b>
                  <span>{{ i: 'int', l: 'long', f: 'float', d: 'double', a: 'reference' }[p]}</span>
                  <span className="faint mono">{n}</span>
                </div>
              ))}
            </div>
            <p className="faint small" style={{ marginTop: 8 }}>
              byte, short, char and boolean have almost no arithmetic of their own: they are widened to int on the stack.
            </p>
          </Card>
        </div>
      </div>

      <Callout tone="blue" title="Notice the shortcuts">
        <code>iload_0</code>…<code>iload_3</code> and <code>iconst_m1</code>…<code>iconst_5</code> exist only to save bytes: the most common locals and constants
        get one-byte forms. A large share of the opcode space is spent on compactness.
      </Callout>
    </Slide>
  );
}

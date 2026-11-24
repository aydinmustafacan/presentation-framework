/** Visual building blocks shared by the JVM sections. */
import type { ReactNode } from 'react';
import './widgets.css';

export function OperandStack({
  values,
  pushed = 0,
  capacity,
  label = 'operand stack',
  compact,
}: {
  values: number[];
  /** how many of the top values were just pushed (they animate in) */
  pushed?: number;
  capacity?: number;
  label?: string;
  compact?: boolean;
}) {
  const slots = Math.max(capacity ?? 0, values.length);
  return (
    <div className={`opstack ${compact ? 'is-compact' : ''}`}>
      <div className="w-label">{label}</div>
      <div className="opstack-well">
        {Array.from({ length: slots }, (_, k) => slots - 1 - k).map((i) => {
          const v = values[i];
          const isTop = i === values.length - 1;
          const isNew = i >= values.length - pushed;
          return (
            <div key={`${i}-${v}-${isNew}`} className={`opstack-slot ${v === undefined ? 'is-empty' : ''} ${isTop ? 'is-top' : ''} ${isNew && v !== undefined ? 'is-new' : ''}`}>
              {v !== undefined && <span>{v}</span>}
              {isTop && <em>top</em>}
            </div>
          );
        })}
        {slots === 0 && <div className="opstack-slot is-empty" />}
      </div>
    </div>
  );
}

export function Locals({ names, values, changed = [], label = 'local variables' }: { names: string[]; values: (number | null)[]; changed?: number[]; label?: string }) {
  return (
    <div className="locals">
      <div className="w-label">{label}</div>
      <table>
        <tbody>
          {values.map((v, i) => (
            <tr key={i} className={changed.includes(i) ? 'is-changed' : ''}>
              <td className="locals-slot">{i}</td>
              <td className="locals-name">{names[i] ?? ''}</td>
              <td className="locals-val" key={`${v}`}>
                {v ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Registers({ regs, read = [], wrote = [] }: { regs: Record<string, number | null>; read?: string[]; wrote?: string[] }) {
  const names = Object.keys(regs).sort((a, b) => (a[0] === b[0] ? Number(a.slice(1)) - Number(b.slice(1)) : a[0] === 'v' ? -1 : 1));
  return (
    <div className="regs">
      <div className="w-label">register file</div>
      <div className="regs-grid">
        {names.map((r) => (
          <div key={r} className={`reg ${wrote.includes(r) ? 'is-write' : read.includes(r) ? 'is-read' : ''}`}>
            <span className="reg-name">{r}</span>
            <span className="reg-val" key={`${regs[r]}`}>
              {regs[r] ?? '—'}
            </span>
          </div>
        ))}
      </div>
      <div className="regs-legend">
        <span className="is-read">read</span>
        <span className="is-write">written</span>
      </div>
    </div>
  );
}

export function Note({ children, done }: { children: ReactNode; done?: boolean }) {
  return <div className={`vm-note ${done ? 'is-done' : ''}`}>{children}</div>;
}

export function NumberInputs({ names, values, onChange, min = -99, max = 999 }: { names: readonly string[]; values: number[]; onChange: (v: number[]) => void; min?: number; max?: number }) {
  return (
    <div className="num-inputs">
      {names.map((n, i) => (
        <label key={n}>
          <span>{n} =</span>
          <input
            type="number"
            value={values[i]}
            min={min}
            max={max}
            onChange={(e) => {
              const next = [...values];
              next[i] = Math.max(min, Math.min(max, Math.trunc(Number(e.target.value) || 0)));
              onChange(next);
            }}
          />
        </label>
      ))}
    </div>
  );
}

/** Horizontal comparison bar pair. */
export function Bars({ rows }: { rows: { label: ReactNode; stack: number; reg: number; unit?: string }[] }) {
  return (
    <div className="bars">
      {rows.map((r, i) => {
        const max = Math.max(r.stack, r.reg, 1);
        return (
          <div className="bars-row" key={i}>
            <div className="bars-label">{r.label}</div>
            <div className="bars-track">
              <div className="bar is-stack" style={{ width: `${(r.stack / max) * 100}%` }}>
                <span>{r.stack}{r.unit}</span>
              </div>
              <div className="bar is-reg" style={{ width: `${(r.reg / max) * 100}%` }}>
                <span>{r.reg}{r.unit}</span>
              </div>
            </div>
          </div>
        );
      })}
      <div className="bars-legend">
        <span className="is-stack">stack (JVM)</span>
        <span className="is-reg">register (Dalvik-style)</span>
      </div>
    </div>
  );
}

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import './deck.css';

/** Colour language of this deck: orange = Python / GraalPy, blue = Java / the JVM host, green = compiled / fast, red = interpreter-only / deopt, violet = measured data. */

export function Note({ children, tone }: { children: ReactNode; tone?: 'green' | 'red' | 'blue' | 'accent' }) {
  return <div className={`g-note ${tone ? `is-${tone}` : ''}`}>{children}</div>;
}

export function Label({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="g-label" style={style}>{children}</div>;
}

export function Measured({ children }: { children?: ReactNode }) {
  return (
    <div className="g-measured">
      <b>Measured</b> {children ?? 'on the example project in decks/graalpy/example/flask-jar (GraalPy 25.0.5, Apple M1 Pro). Re-run with the scripts there.'}
    </div>
  );
}

/** Horizontal bar with a value label; width relative to `max`. */
export function HBar({ value, max, tone = 'accent', label, title }: { value: number; max: number; tone?: string; label?: ReactNode; title?: string }) {
  return (
    <div className="g-hbar" title={title}>
      <div className="g-hbar-fill" style={{ width: `${Math.max(0.4, Math.min(100, (value / max) * 100))}%`, '--c': `var(--${tone})` } as CSSProperties} />
      {label !== undefined && <span className="g-hbar-label">{label}</span>}
    </div>
  );
}

/** Wrap a scrollable <Code>; whenever `dep` changes, scroll its first highlighted line to the middle (without scrolling the page). */
export function AutoScroll({ dep, children }: { dep: unknown; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current?.querySelector<HTMLElement>('.code');
    const line = box?.querySelector<HTMLElement>('.code-line.is-active');
    if (box && line) box.scrollTo({ top: line.offsetTop - box.clientHeight / 2 + line.clientHeight * 2, behavior: 'smooth' });
  }, [dep]);
  return <div ref={ref} className="g-autoscroll">{children}</div>;
}

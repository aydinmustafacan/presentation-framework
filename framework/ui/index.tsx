/**
 * The page UI kit. Import in any section with:   import { Slide, Card, ... } from '@framework';
 * Every page is bundled on its own, so only what a page uses ends up in its HTML.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { highlight, type Lang } from './highlight.ts';

export { highlight, type Lang };

/* ------------------------------------------------------------------ section context */

export interface SectionInfo {
  id: string;
  number: string;
  title: string;
}
const SectionContext = createContext<SectionInfo>({ id: 'ch0', number: '0', title: 'Untitled' });
export const SectionProvider = SectionContext.Provider;
/** Number and title derived from the folder name, e.g. ch2.1_The_operand_stack. */
export const useSection = () => useContext(SectionContext);

/* ------------------------------------------------------------------ layout */

export function Slide({
  title,
  lead,
  children,
  center,
  width = 1180,
}: {
  /** Defaults to the title from the folder name. */
  title?: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  /** Vertically center the content (cover pages). */
  center?: boolean;
  width?: number;
}) {
  const s = useSection();
  return (
    <div className={`slide ${center ? 'slide-center' : ''}`} style={{ '--slide-w': `${width}px` } as CSSProperties}>
      <header className="slide-head">
        <div className="slide-num">{s.number.includes('.') ? `Section ${s.number}` : `Chapter ${s.number}`}</div>
        <h1 className="slide-title">{title ?? s.title}</h1>
        {lead && <p className="slide-lead">{lead}</p>}
      </header>
      <div className="slide-body">{children}</div>
    </div>
  );
}

export function Grid({ cols = 2, gap = 16, children, style }: { cols?: number | string; gap?: number; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: typeof cols === 'number' ? `repeat(${cols}, minmax(0, 1fr))` : cols, gap, ...style }}>
      {children}
    </div>
  );
}

export function Card({
  title,
  aside,
  children,
  tone,
  className = '',
  style,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  tone?: Tone;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section className={`card ${tone ? `tone-${tone}` : ''} ${className}`} style={style}>
      {(title || aside) && (
        <header className="card-head">
          {title && <h3 className="card-title">{title}</h3>}
          {aside && <div className="card-aside">{aside}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export type Tone = 'accent' | 'blue' | 'green' | 'red' | 'violet' | 'muted';

export function Callout({ tone = 'accent', title, children }: { tone?: Tone; title?: ReactNode; children: ReactNode }) {
  return (
    <div className={`callout tone-${tone}`}>
      {title && <div className="callout-title">{title}</div>}
      <div>{children}</div>
    </div>
  );
}

export function Tag({ tone = 'muted', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span className={`tag tone-${tone}`} title={title}>
      {children}
    </span>
  );
}

export function Stat({ label, value, tone = 'accent', hint }: { label: ReactNode; value: ReactNode; tone?: Tone; hint?: ReactNode }) {
  return (
    <div className={`stat tone-${tone}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ controls */

export function Button({
  variant = 'default',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'ghost' }) {
  return <button className={`btn btn-${variant} ${className}`} {...rest} />;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={o.value === value} className={o.value === value ? 'is-on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ stepping */

export interface Stepper {
  step: number;
  total: number;
  playing: boolean;
  atEnd: boolean;
  next: () => void;
  prev: () => void;
  reset: () => void;
  goTo: (n: number) => void;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  speed: number;
  setSpeed: (ms: number) => void;
}

/** Index-based stepping with autoplay. `total` is the number of states (0..total-1). */
export function useStepper(total: number, initialSpeed = 700): Stepper {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(initialSpeed);
  const atEnd = step >= total - 1;

  useEffect(() => {
    if (step > total - 1) setStep(Math.max(0, total - 1));
  }, [total, step]);

  useEffect(() => {
    if (!playing) return;
    if (atEnd) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), speed);
    return () => clearTimeout(t);
  }, [playing, step, atEnd, speed]);

  return {
    step,
    total,
    playing,
    atEnd,
    speed,
    setSpeed,
    next: useCallback(() => setStep((s) => Math.min(total - 1, s + 1)), [total]),
    prev: useCallback(() => setStep((s) => Math.max(0, s - 1)), []),
    reset: useCallback(() => {
      setPlaying(false);
      setStep(0);
    }, []),
    goTo: useCallback((n: number) => setStep(Math.max(0, Math.min(total - 1, n))), [total]),
    play: useCallback(() => setPlaying(true), []),
    pause: useCallback(() => setPlaying(false), []),
    toggle: useCallback(() => {
      setPlaying((p) => {
        if (!p && step >= total - 1) setStep(0);
        return !p;
      });
    }, [step, total]),
  };
}

/**
 * Step / play controls. Keys inside the page: Space = play/pause, "." = step, "," = back.
 * (Arrow keys stay reserved for moving between sections.)
 */
export function StepControls({ stepper, label }: { stepper: Stepper; label?: ReactNode }) {
  const { step, total, playing, atEnd, next, prev, reset, toggle, speed, setSpeed } = stepper;
  const ref = useRef({ next, prev, toggle });
  ref.current = { next, prev, toggle };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || e.metaKey || e.ctrlKey) return;
      if (e.key === ' ' && t.tagName !== 'BUTTON') {
        e.preventDefault();
        ref.current.toggle();
      } else if (e.key === '.') ref.current.next();
      else if (e.key === ',') ref.current.prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="step-controls">
      <Button onClick={reset} disabled={step === 0} title="Reset">
        ⟲
      </Button>
      <Button onClick={prev} disabled={step === 0} title="Step back (,)">
        ◀
      </Button>
      <Button variant="primary" onClick={toggle} title="Play / pause (space)" style={{ minWidth: 84 }}>
        {playing ? '❚❚ Pause' : atEnd ? '↻ Replay' : '▶ Play'}
      </Button>
      <Button onClick={next} disabled={atEnd} title="Step (.)">
        ▶︎ Step
      </Button>
      <label className="speed" title="Autoplay speed">
        <span>slow</span>
        <input type="range" min={150} max={1500} step={50} value={1650 - speed} onChange={(e) => setSpeed(1650 - Number(e.target.value))} />
        <span>fast</span>
      </label>
      <div className="step-label">{label ?? `step ${step} / ${total - 1}`}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ code */

export function Code({
  code,
  lang = 'text',
  active,
  dim,
  onHoverLine,
  onClickLine,
  numbers = false,
  className = '',
  style,
}: {
  code: string;
  lang?: Lang;
  /** 1-based line numbers to highlight */
  active?: number[] | number;
  /** dim lines that are not active */
  dim?: boolean;
  onHoverLine?: (line: number | null) => void;
  onClickLine?: (line: number) => void;
  numbers?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const lines = code.replace(/\n$/, '').split('\n');
  const act = new Set(active === undefined ? [] : Array.isArray(active) ? active : [active]);
  const interactive = Boolean(onHoverLine || onClickLine);
  return (
    <pre className={`code ${className}`} style={style} onMouseLeave={onHoverLine && (() => onHoverLine(null))}>
      {lines.map((l, i) => {
        const n = i + 1;
        const on = act.has(n);
        return (
          <div
            key={i}
            className={`code-line ${on ? 'is-active' : ''} ${dim && act.size && !on ? 'is-dim' : ''} ${interactive ? 'is-interactive' : ''}`}
            onMouseEnter={onHoverLine && (() => onHoverLine(n))}
            onClick={onClickLine && (() => onClickLine(n))}
          >
            {numbers && <span className="code-ln">{n}</span>}
            <span className="code-text">{highlight(l, lang)}</span>
          </div>
        );
      })}
    </pre>
  );
}

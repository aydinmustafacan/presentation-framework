import { useEffect, useReducer, useState } from 'react';
import { Slide, Card, Button, Stat, Callout, Tag, Code } from '@framework';
import './style.css';

/*
 * A toy model of HotSpot tiered compilation. Thresholds are HotSpot's default flag values
 * (Tier3InvocationThreshold=200, Tier4InvocationThreshold=5000); per-call costs and compile
 * delays are illustrative, chosen to show the shape of the curve, not measured.
 */
const TIERS = {
  0: { name: 'Tier 0 · interpreter', cost: 100, color: 'var(--red)' },
  3: { name: 'Tier 3 · C1 + profiling', cost: 32, color: 'var(--yellow)' },
  4: { name: 'Tier 4 · C2 optimised', cost: 6, color: 'var(--green)' },
} as const;
type Tier = keyof typeof TIERS;

const C1_AT = 200;
const C2_AT = 5000;
const C1_DELAY = 60;
const C2_DELAY = 700;
const MAX = 12000;
const SAMPLE = 40;

interface State {
  calls: number;
  /** calls since the last deopt (profile counter) */
  counter: number;
  tier: Tier;
  pending: { tier: Tier; readyAt: number } | null;
  time: number;
  history: { calls: number; cost: number }[];
  log: { at: number; text: string; tone: 'accent' | 'green' | 'red' | 'blue' }[];
  deopts: number;
}

const initial: State = { calls: 0, counter: 0, tier: 0, pending: null, time: 0, history: [{ calls: 0, cost: TIERS[0].cost }], log: [], deopts: 0 };

type Action = { type: 'run'; n: number } | { type: 'deopt' } | { type: 'reset' };

function reducer(s: State, a: Action): State {
  if (a.type === 'reset') return initial;
  if (a.type === 'deopt') {
    if (s.tier !== 4) return s;
    return {
      ...s,
      tier: 0,
      counter: 0,
      pending: null,
      deopts: s.deopts + 1,
      log: [...s.log, { at: s.calls, text: 'A new receiver type shows up: C2’s speculation (“this call site only ever sees ArrayList”) is wrong. Deoptimise → back to the interpreter, re-profile.', tone: 'red' }],
    };
  }
  let { calls, counter, tier, pending, time } = s;
  const history = [...s.history];
  const log = [...s.log];
  for (let i = 0; i < a.n && calls < MAX; i++) {
    calls++;
    counter++;
    time += TIERS[tier].cost;
    if (pending && calls >= pending.readyAt) {
      tier = pending.tier;
      log.push({ at: calls, text: `${TIERS[tier].name} code installed — the next call jumps straight into native code.`, tone: tier === 4 ? 'green' : 'accent' });
      pending = null;
    }
    if (!pending && tier === 0 && counter >= C1_AT) {
      pending = { tier: 3, readyAt: calls + C1_DELAY };
      log.push({ at: calls, text: `${counter} invocations ≥ Tier3InvocationThreshold (${C1_AT}). Queue a C1 compile in the background; keep interpreting meanwhile.`, tone: 'blue' });
    }
    if (!pending && tier === 3 && counter >= C2_AT) {
      pending = { tier: 4, readyAt: calls + C2_DELAY };
      log.push({ at: calls, text: `${counter} invocations ≥ Tier4InvocationThreshold (${C2_AT}). Profile is rich enough: queue a C2 compile (slower, much better code).`, tone: 'blue' });
    }
    if (calls % SAMPLE === 0) history.push({ calls, cost: TIERS[tier].cost });
  }
  return { ...s, calls, counter, tier, pending, time, history, log };
}

const SRC = `static long hot(List<Integer> xs) {
    long sum = 0;
    for (int x : xs) sum += x;   // xs.iterator(), next(), intValue()
    return sum;
}`;

export default function Page() {
  const [s, dispatch] = useReducer(reducer, initial);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    if (s.calls >= MAX) {
      setRunning(false);
      return;
    }
    const t = setTimeout(() => dispatch({ type: 'run', n: s.tier === 4 ? 160 : s.calls < 400 ? 8 : 60 }), 40);
    return () => clearTimeout(t);
  }, [running, s.calls, s.tier]);

  const W = 640;
  const H = 180;
  const x = (c: number) => (c / MAX) * W;
  const y = (cost: number) => H - (cost / 110) * H;
  const path = s.history.map((h, i) => `${i ? 'L' : 'M'}${x(h.calls).toFixed(1)},${y(h.cost).toFixed(1)}`).join(' ');
  const interpOnly = s.calls * TIERS[0].cost;
  const speedup = s.time ? interpOnly / s.time : 1;

  return (
    <Slide lead="Every method starts in the interpreter. Counters find the hot ones; C1 compiles them quickly, C2 compiles them well — and if C2’s assumptions break, the JVM throws the code away and starts over.">
      <div className="ee-grid">
        <Card title="Cost per call of hot()" aside={<Tag tone="muted">illustrative costs · real HotSpot thresholds</Tag>}>
          <svg viewBox={`-34 -10 ${W + 44} ${H + 34}`} className="ee-chart" role="img" aria-label="Cost per call over invocations">
            {([0, 3, 4] as Tier[]).map((t) => (
              <g key={t}>
                <line x1={0} x2={W} y1={y(TIERS[t].cost)} y2={y(TIERS[t].cost)} className="ee-grid-line" />
                <text x={-8} y={y(TIERS[t].cost) + 4} textAnchor="end" className="ee-axis">
                  {TIERS[t].cost}
                </text>
              </g>
            ))}
            {[C1_AT, C2_AT].map((c) => (
              <g key={c}>
                <line x1={x(c)} x2={x(c)} y1={0} y2={H} className="ee-threshold" />
                <text x={x(c) + 4} y={10} className="ee-axis">
                  {c}
                </text>
              </g>
            ))}
            <path d={path} className="ee-line" />
            <circle cx={x(s.calls)} cy={y(TIERS[s.tier].cost)} r={5} style={{ fill: TIERS[s.tier].color }} />
            <text x={W} y={H + 22} textAnchor="end" className="ee-axis">
              invocations →
            </text>
            <text x={0} y={H + 22} className="ee-axis">
              0
            </text>
          </svg>
          <div className="row" style={{ marginTop: 10 }}>
            <Button variant="primary" onClick={() => setRunning((r) => !r)} disabled={s.calls >= MAX}>
              {running ? '❚❚ Pause' : '▶ Keep calling hot()'}
            </Button>
            <Button onClick={() => dispatch({ type: 'run', n: 100 })} disabled={s.calls >= MAX}>
              +100 calls
            </Button>
            <Button onClick={() => dispatch({ type: 'deopt' })} disabled={s.tier !== 4}>
              ⚡ Pass a LinkedList
            </Button>
            <Button
              onClick={() => {
                setRunning(false);
                dispatch({ type: 'reset' });
              }}
            >
              ⟲ Reset
            </Button>
          </div>
        </Card>

        <div className="ee-side">
          <div className="tier-badge" style={{ borderColor: TIERS[s.tier].color, color: TIERS[s.tier].color }}>
            {TIERS[s.tier].name}
            {s.pending && <span className="tier-pending">compiling {s.pending.tier === 3 ? 'C1' : 'C2'}…</span>}
          </div>
          <div className="ee-stats">
            <Stat label="invocations" value={s.calls.toLocaleString()} />
            <Stat label="vs. interpreting forever" value={`${speedup.toFixed(1)}×`} tone="green" />
          </div>
          <Code code={SRC} lang="java" />
        </div>
      </div>

      <Card title="What the JVM decided">
        <div className="ee-log">
          {s.log.length === 0 && <div className="muted">Press play. Watch for the two thresholds.</div>}
          {[...s.log].reverse().map((l, i) => (
            <div key={s.log.length - i} className={`ee-log-row tone-${l.tone}`}>
              <span className="mono">#{l.at.toLocaleString()}</span>
              <span>{l.text}</span>
            </div>
          ))}
        </div>
      </Card>

      <Callout tone="blue" title="Why interpret first at all?">
        Compiling everything up front would waste time on code that runs once — and would have to guess. Interpreting first gives the JIT real
        profiles: which branches are taken, which types reach each call site. C2 bets on them (inlining <code>ArrayList.iterator()</code> directly)
        and keeps a deoptimisation trap in case the bet loses.
      </Callout>
    </Slide>
  );
}

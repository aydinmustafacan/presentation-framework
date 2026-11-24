import { useMemo, useState } from 'react';
import { Slide, Card, Segmented, StepControls, Stat, useStepper } from '@framework';
import { trace } from '../_shared/search.ts';
import './style.css';

const XS = Array.from({ length: 32 }, (_, i) => i * 3);
const TARGETS = ['45', '93', '44'] as const;

export default function Page() {
  const [target, setTarget] = useState<(typeof TARGETS)[number]>('93');
  const t = useMemo(() => trace(XS, Number(target)), [target]);
  const st = useStepper(t.length, 1000);
  const s = t[st.step];

  return (
    <Slide lead="Each comparison with the middle element throws away half of what's left. 32 values never need more than 6 comparisons.">
      <div className="row">
        <Segmented
          label="Target"
          value={target}
          onChange={(v) => {
            setTarget(v);
            st.reset();
          }}
          options={TARGETS.map((v) => ({ value: v, label: `find ${v}${XS.includes(Number(v)) ? '' : ' (absent)'}` }))}
        />
      </div>
      <Card title="Sorted array">
        <div className="bs-cells">
          {XS.map((x, i) => {
            const out = i < s.lo || i > s.hi;
            return (
              <div key={i} className={`bs-cell ${out ? 'is-out' : ''} ${i === s.mid ? (s.found === i ? 'is-found' : 'is-mid') : ''}`}>
                <span className="bs-val">{x}</span>
                <span className="bs-idx">{i}</span>
              </div>
            );
          })}
        </div>
      </Card>
      <div className="bs-note">{s.note}</div>
      <StepControls stepper={st} />
      <div className="bs-stats">
        <Stat label="comparisons" value={s.comparisons} />
        <Stat label="candidates left" value={Math.max(0, s.hi - s.lo + 1)} tone="blue" />
        <Stat label="worst case for 32 values" value="6" tone="green" hint="⌊log₂ 32⌋ + 1" />
      </div>
    </Slide>
  );
}

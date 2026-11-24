import { useMemo, useState } from 'react';
import { Slide, Card, Code, Segmented, StepControls, useStepper, Tag } from '@framework';
import './style.css';

type Loader = 'app' | 'platform' | 'boot';
const LOADERS: { id: Loader; name: string; source: string }[] = [
  { id: 'boot', name: 'Bootstrap loader', source: 'java.base, … (native, part of the JVM)' },
  { id: 'platform', name: 'Platform loader', source: 'java.sql, java.xml.crypto, …' },
  { id: 'app', name: 'Application loader', source: '-classpath / --module-path' },
];

const TARGETS = {
  'com.example.Point': 'app',
  'java.sql.Connection': 'platform',
  'java.lang.String': 'boot',
  'com.example.Missing': null,
} as const satisfies Record<string, Loader | null>;
type Target = keyof typeof TARGETS;

type Phase = 'load' | 'verify' | 'prepare' | 'resolve' | 'init';
interface Step {
  at: Loader | null;
  dir?: 'up' | 'down';
  phase?: Phase;
  text: string;
  found?: boolean;
  error?: boolean;
}

const PHASES: { id: Phase; name: string; group: string }[] = [
  { id: 'load', name: 'Load', group: 'Loading' },
  { id: 'verify', name: 'Verify', group: 'Linking' },
  { id: 'prepare', name: 'Prepare', group: 'Linking' },
  { id: 'resolve', name: 'Resolve', group: 'Linking' },
  { id: 'init', name: 'Initialize', group: 'Initialization' },
];

const POINT = `public class Point {
    static int created = 42;        // <clinit>
    static { System.out.println("init"); }
    private final int x, y;
    …
}`;

function steps(target: Target): Step[] {
  const owner = TARGETS[target];
  const short = target.split('.').pop();
  const s: Step[] = [
    { at: 'app', text: `Code in com.example.Main mentions ${short}. The JVM asks Main's defining loader — the application loader — for "${target}".` },
    { at: 'app', dir: 'up', text: 'Parent first: before looking itself, the application loader delegates to its parent.' },
    { at: 'platform', dir: 'up', text: 'The platform loader delegates upward too.' },
  ];
  const order: Loader[] = ['boot', 'platform', 'app'];
  for (const l of order) {
    if (l === owner) {
      s.push({ at: l, found: true, phase: 'load', text: `The ${LOADERS.find((x) => x.id === l)!.name.toLowerCase()} finds ${target} in ${LOADERS.find((x) => x.id === l)!.source.split(',')[0]} and defines it. Delegation guarantees core classes like String can never be replaced by a class on your classpath.` });
      break;
    }
    s.push({
      at: l,
      dir: l === 'app' ? undefined : 'down',
      text: `${LOADERS.find((x) => x.id === l)!.name} doesn't have it${l === 'app' ? '' : ' — the request falls back down to its child'}.`,
    });
  }
  if (!owner) {
    s.push({ at: 'app', error: true, text: 'Nobody found it: ClassNotFoundException (or NoClassDefFoundError if it existed at compile time).' });
    return s;
  }
  s.push(
    { at: owner, phase: 'verify', text: 'Verify: type-check every method using the StackMapTable. No stack underflow, no bad casts, every jump lands on an instruction boundary.' },
    { at: owner, phase: 'prepare', text: 'Prepare: allocate static fields and set them to default values — created = 0, not 42 yet. No user code runs.' },
    { at: owner, phase: 'resolve', text: 'Resolve: symbolic references in the constant pool (“java/lang/Object.<init>:()V”) become direct pointers. HotSpot does this lazily, the first time each instruction runs.' },
    {
      at: owner,
      phase: 'init',
      text: `Initialize: run <clinit> — the static initialisers, in source order — exactly once, under a lock. Triggered by the first new, static call or static field access.${owner === 'boot' ? ' (String is in fact initialized during JVM start-up.)' : ''}`,
    },
  );
  return s;
}

export default function Page() {
  const [target, setTarget] = useState<Target>('com.example.Point');
  const list = useMemo(() => steps(target), [target]);
  const st = useStepper(list.length, 1400);
  const cur = list[st.step];
  const phaseIdx = cur.phase ? PHASES.findIndex((p) => p.id === cur.phase) : -1;
  const owner = TARGETS[target];

  return (
    <Slide lead="Classes are loaded on demand, by a chain of loaders that always ask their parent first. Once found, the class is linked and initialised — in that order, exactly once.">
      <div className="row">
        <Segmented
          value={target}
          onChange={(t) => {
            setTarget(t);
            st.reset();
          }}
          options={Object.keys(TARGETS).map((t) => ({ value: t as Target, label: <span className="mono">{t}</span> }))}
        />
      </div>

      <div className="cl-grid">
        <Card title="Parent delegation">
          <div className="loaders">
            {LOADERS.map((l) => {
              const here = cur.at === l.id;
              const visited = list.slice(0, st.step + 1).some((x) => x.at === l.id);
              return (
                <div key={l.id} className={`loader ${here ? 'is-here' : ''} ${visited ? 'is-visited' : ''} ${here && cur.found ? 'is-found' : ''} ${here && cur.error ? 'is-error' : ''} ${phaseIdx >= 0 && owner === l.id ? 'is-owner' : ''}`}>
                  <div className="loader-name">{l.name}</div>
                  <div className="loader-src">{l.source}</div>
                  {here && cur.dir && <div className={`loader-dir ${cur.dir}`}>{cur.dir === 'up' ? '↑ delegate to parent' : '↓ back to child'}</div>}
                  {phaseIdx >= 0 && owner === l.id && <Tag tone="green">defines {target.split('.').pop()}</Tag>}
                </div>
              );
            })}
          </div>
        </Card>

        <div className="cl-right">
          <div className="phases">
            {PHASES.map((p, i) => (
              <div key={p.id} className={`phase ${i === phaseIdx ? 'is-on' : ''} ${i < phaseIdx ? 'is-done' : ''}`}>
                <div className="phase-group">{p.group}</div>
                <div className="phase-name">{p.name}</div>
              </div>
            ))}
          </div>
          <div className={`cl-note ${cur.error ? 'is-error' : ''}`} key={`${target}-${st.step}`}>
            {cur.text}
          </div>
          {target === 'com.example.Point' && (
            <div className="prepare-demo">
              <Code code={POINT} lang="java" active={phaseIdx === 4 ? [2, 3] : phaseIdx === 2 ? [2] : []} />
              <div className="static-val">
                <span className="muted mono small">Point.created</span>
                <b className="mono">{phaseIdx < 2 ? '—' : phaseIdx < 4 ? '0' : '42'}</b>
              </div>
            </div>
          )}
        </div>
      </div>

      <StepControls stepper={st} />
    </Slide>
  );
}

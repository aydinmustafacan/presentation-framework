import { useState, type CSSProperties } from 'react';
import { Slide, Grid, Callout } from '@framework';
import { A, RT, RT_IDS, jythonJarBytes, fatJarBytes, type RtId } from '../../../graalpy/sections/_shared/alt.ts';
import { M, MB } from '../../../graalpy/sections/_shared/data.ts';
import { Measured } from '../../../graalpy/sections/_shared/ui.tsx';
import './style.css';

type Fit = 'yes' | 'partly' | 'no';
interface Req { id: string; label: string; fit: Record<RtId, [Fit, string]> }
const R = A.runtimes;
const firstErr = (s: string) => s.replace(/^\w+Exception: /, '').split(' (')[0].split('("')[0];

const REQS: Req[] = [
  {
    id: 'py3', label: 'Modern Python 3 code and packages (Flask 3, f-strings, typing …)',
    fit: {
      jython: ['no', `Python ${R.jython.python}. An f-string is a ${firstErr(R.jython.fstring).split(':')[0]} (measured). Python 2 reached end of life in 2020; current Flask does not support it.`],
      jep: ['yes', `Whatever CPython you install: ${R.jep.python} here.`],
      graalpy: ['yes', `Python ${R.graalpy.python}; Flask ${M.versions.flask} runs in chapter 2.`],
    },
  },
  {
    id: 'cext', label: 'C extensions: numpy, pandas, scipy …',
    fit: {
      jython: ['no', `No C-API at all: "${R.jython.numpy}".`],
      jep: ['yes', `The point of JEP: numpy imported and computed ${R.jep.numpy.replace('ok ', '')} (measured). Any wheel that works on that CPython works.`],
      graalpy: ['partly', 'Needs packages built for GraalPy’s C-API emulation, per platform (2.3). Many popular ones have builds; not tested here.'],
    },
  },
  {
    id: 'jar', label: 'Ship one artifact; no Python installed on the server',
    fit: {
      jython: ['yes', `One ${MB(jythonJarBytes, 0)} jython-standalone JAR.`],
      jep: ['no', 'Needs CPython, the packages and libjep (built for that OS, CPU and Python) on every machine.'],
      graalpy: ['yes', `The whole Flask app is one ${MB(fatJarBytes, 0)} JAR (chapter 2).`],
    },
  },
  {
    id: 'threads', label: 'Python running in parallel on several Java threads',
    fit: {
      jython: ['yes', `No GIL: ${(R.jython.threads * R.jython.thread1Ms / R.jython.threadNMs).toFixed(1)}× parallel with ${R.jython.threads} threads (measured).`],
      jep: ['partly', `Shared interpreters serialise on the GIL; isolated sub-interpreters scale (${(R.jep.threads * R.jep.isolated1Ms! / R.jep.isolatedNMs!).toFixed(1)}×) but numpy could not load in them (measured).`],
      graalpy: ['yes', `One Context per thread: ${(R.graalpy.threads * R.graalpy.thread1Ms / R.graalpy.threadNMs).toFixed(1)}× with ${R.graalpy.threads} threads (measured).`],
    },
  },
  {
    id: 'seam', label: 'Python code that uses Java objects heavily',
    fit: {
      jython: ['yes', 'Python and Java share one object model: Java objects behave like Python objects, subclassing Java classes works.'],
      jep: ['partly', 'Works through PyJObject wrappers and JNI; every crossing goes through the native bridge.'],
      graalpy: ['yes', 'Polyglot interop: import java and java.type() from Python, Java objects passed in as proxies. Needs host access allowed.'],
    },
  },
];

const ICON: Record<Fit, string> = { yes: '✓', partly: '~', no: '✗' };

export default function Page() {
  const [on, setOn] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setOn((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const picked = REQS.filter((r) => on.has(r.id));
  const verdict = (id: RtId): Fit => (picked.some((r) => r.fit[id][0] === 'no') ? 'no' : picked.some((r) => r.fit[id][0] === 'partly') ? 'partly' : 'yes');

  return (
    <Slide lead="None of the three is best at everything; each wins one column. Switch on what your project needs and see which runtime is left standing, and why.">
      <Grid cols="minmax(0, 0.9fr) minmax(0, 2fr)" gap={18}>
        <div className="reqs">
          {REQS.map((r) => (
            <label key={r.id} className={`req ${on.has(r.id) ? 'is-on' : ''}`}>
              <input type="checkbox" checked={on.has(r.id)} onChange={() => toggle(r.id)} />
              <span>{r.label}</span>
            </label>
          ))}
        </div>
        <Grid cols={3} gap={12}>
          {RT_IDS.map((id) => {
            const v = verdict(id);
            return (
              <div key={id} className={`verdict v-${v}`} style={{ '--rt': `var(--${RT[id].tone})` } as CSSProperties}>
                <div className="v-head">
                  <b>{RT[id].name}</b>
                  <span className={`v-badge f-${v}`}>{picked.length === 0 ? 'pick a need' : v === 'yes' ? 'fits' : v === 'partly' ? 'fits, with caveats' : 'ruled out'}</span>
                </div>
                {picked.map((r) => {
                  const [f, why] = r.fit[id];
                  return (
                    <div key={r.id} className={`v-item f-${f}`}>
                      <span className="ic">{ICON[f]}</span>
                      <span className="small">{why}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </Grid>
      </Grid>
      <Callout title="Rule of thumb">
        <b>JEP</b> when you need the scientific Python stack and can install CPython next to the JVM. <b>GraalPy</b> when you want modern Python shipped inside a Java artifact, ideally on a GraalVM JDK. <b>Jython</b> mostly for existing Python 2 scripting inside Java applications.
      </Callout>
      <Measured>Items marked “measured” come from decks/graalpy/example/alternatives and the GraalPy deck; the rest describe documented behaviour and were not tested here.</Measured>
    </Slide>
  );
}

import { Code, Slide, StepControls, useStepper } from '@framework';
import { formatMethod, methodSource } from '../../../../sections/_shared/bytecode.ts';
import { run, simMethod } from '../../../../sections/_shared/stackvm.ts';
import { Flow, SourceLinks, Surface } from '../_shared/ui.tsx';

const source = methodSource('Sim', 'arith').code;
const bytecode = formatMethod(simMethod('arith'));
const trace = run('arith', [3, 4, 5]);
const stages = [
  { label: 'Sim.java', detail: 'Java source' },
  { label: 'javac', detail: 'Compiles source' },
  { label: 'Sim.class', detail: 'Contains JVM bytecode', tone: 'artifact' },
  { label: 'JVM', detail: 'Loads and executes the class', tone: 'artifact' },
] as const;

export default function Bytecode() {
  const stepper = useStepper(trace.length);
  const snapshot = trace[stepper.step];
  const frame = snapshot.frames.at(-1)!;

  return (
    <Slide title="Java bytecode and the operand stack" lead="Bytecode is the JVM’s instruction format. Each method call gets a frame on its thread’s call stack, with local variables and a separate operand stack.">
      <Flow stages={stages} />
      <div className="split">
        <Surface title="Source and javap output">
          <Code code={source} lang="java" />
          <Code code={bytecode} lang="jvm" active={snapshot.executed && [snapshot.executed.index + 1]} />
        </Surface>
        <Surface title="Run arith(3, 4, 5)">
          <div aria-live="polite">
            {snapshot.done ? (
              <><span className="small-note">Returned to the caller. The method frame is gone.</span><div className="stack-result">{snapshot.result}</div></>
            ) : (
              <div className="stack-frame">
                <div>
                  <h3>Local slots</h3>
                  <dl>
                    {frame.locals.map((value, slot) => (
                      <div key={slot}><dt>{slot} · {frame.localNames[slot]}</dt><dd>{value}</dd></div>
                    ))}
                  </dl>
                </div>
                <div>
                  <h3>Operand stack</h3>
                  {frame.stack.length === 0 ? <p className="small-note">Empty</p> : (
                    <ol aria-label="Operand stack, top first">
                      {[...frame.stack].reverse().map((value, index) => (
                        <li className="stack-cell" key={index}>{value}{index === 0 && <span>top</span>}</li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            )}
            <p>{snapshot.note}</p>
          </div>
        </Surface>
      </div>
      <StepControls stepper={stepper} />
      <p className="padded-note">A JAR can contain compiled <code>.class</code> files and resources. The JVM executes the Java entry point. An embedded language runtime can load app code from the same archive.</p>
      <SourceLinks links={[['JVM specification · Frames', 'https://docs.oracle.com/javase/specs/jvms/se25/html/jvms-2.html#jvms-2.6']]} />
    </Slide>
  );
}

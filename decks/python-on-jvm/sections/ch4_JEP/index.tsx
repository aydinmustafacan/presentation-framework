import { Code, Slide } from '@framework';
import { jepDocs } from '../_shared/demo.ts';
import { Flow, SourceLinks, Surface } from '../_shared/ui.tsx';

const stages = [
  { label: 'Java service', tone: 'artifact' },
  { label: 'JEP via JNI', detail: 'Java Native Interface', tone: 'boundary' },
  { label: 'CPython', detail: 'Same OS process', tone: 'guest' },
] as const;

const snippet = `import jep.SharedInterpreter;

try (SharedInterpreter python = new SharedInterpreter()) {
    python.exec("import flask");
    python.exec("from app import app");
}`;

export default function Jep() {
  return (
    <Slide lead="JEP embeds the native CPython interpreter inside the Java process through JNI. It can run a modern Flask app with a compatible CPython environment.">
      <Flow stages={stages} />
      <div className="split">
        <Surface title="Load the Flask app from Java">
          <Code code={snippet} lang="java" />
          <p className="small-note">Illustrative snippet. It assumes a configured JEP installation and that Flask and the app are importable. Serving HTTP still takes an adapter or a Python server.</p>
        </Surface>
        <Surface title="Fit for the Flask service">
          <p>CPython is an advantage when the dependency set relies on CPython-native packages. Validate those packages with the chosen interpreter mode and worker model.</p>
          <p>Deployment must provide a compatible CPython runtime, the JEP native library and Python packages for each target. The standard embedding model also ties interpreter operations to the thread that created the interpreter.</p>
        </Surface>
      </div>
      <SourceLinks links={[
        ['JEP project and installation', 'https://github.com/ninia/jep'],
        ['JEP interpreter and threading model', jepDocs],
      ]} />
    </Slide>
  );
}

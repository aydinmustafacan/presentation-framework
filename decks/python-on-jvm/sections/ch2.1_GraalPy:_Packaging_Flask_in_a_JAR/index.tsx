import { useState } from 'react';
import { Code, Slide } from '@framework';
import { buildDocs, gradleBuild } from '../_shared/demo.ts';
import { Flow, SourceLinks, Surface } from '../_shared/ui.tsx';

const projectTree = [
  'todo-gradle/',
  '├── settings.gradle.kts',
  '├── build.gradle.kts             GraalPy + Shadow plugins',
  '└── src/main/',
  '    ├── java/demo/Main.java      opens Python, runs app.run()',
  '    └── resources/org.graalvm.python.vfs/src/',
  '        ├── app.py               the Flask app',
  '        └── templates/index.html Jinja page',
].join('\n');

/** The plugin line and the graalPy { … } block from build.gradle.kts, read from the real file. */
const gradleLines = gradleBuild.split('\n');
const graalPyStart = gradleLines.findIndex((l) => l.startsWith('graalPy {'));
const graalPyEnd = gradleLines.findIndex((l, i) => i > graalPyStart && l.startsWith('}'));
const gradleExcerpt = [
  'plugins {',
  ...gradleLines.filter((l) => l.includes('id("org.graalvm.python")')),
  '}',
  '',
  ...gradleLines.slice(graalPyStart, graalPyEnd + 1),
].join('\n');

const buildSteps = [
  {
    label: 'Install', detail: 'GraalPy Gradle plugin', tone: 'guest',
    title: 'Resolve Flask at build time',
    explanation: 'The GraalPy Gradle plugin installs Flask and its transitive dependencies using the GraalPy environment. Pin the full dependency set for repeatable service builds.',
    code: gradleExcerpt,
    lang: 'java',
  },
  {
    label: 'Package', detail: 'Java classes + Python resources', tone: 'artifact',
    title: 'Assemble the runnable JAR',
    explanation: 'The Shadow plugin bundles the Java entry point and GraalPy dependencies. The app source and Flask packages go into the same archive as Java resources. GraalPy’s virtual filesystem (VFS) exposes them to Python imports.',
    code: [
      'demo/Main.class',
      'META-INF/MANIFEST.MF',
      'org.graalvm.python.vfs/',
      '  src/app.py',
      '  src/templates/index.html',
      '  venv/lib/python3.12/site-packages/flask/__init__.py',
    ].join('\n'),
    lang: 'text',
  },
  {
    label: 'Launch', detail: 'java -jar', tone: 'boundary',
    title: 'Start with the usual Java command',
    explanation: 'The demo starts on the local Corretto 25 JDK and uses a fallback interpreter there. The deployment test needs the target JDK, OS and CPU architecture, with the real dependency set and permission to write any required runtime caches.',
    code: [
      'cd decks/graalpy/example/todo-gradle',
      'gradle shadowJar',
      'java -jar build/libs/todo-gradle-1.0.jar 8080',
      'curl http://localhost:8080/api/todos',
    ].join('\n'),
    lang: 'text',
  },
] as const;

export default function Packaging() {
  const [active, setActive] = useState(0);
  const step = buildSteps[active];

  return (
    <Slide title="GraalPy: Packaging Flask in a JAR" lead="Gradle installs Python dependencies at build time and bundles them with the Java host. The result uses the familiar java -jar entry point.">
      <Flow stages={buildSteps} selected={active} onSelect={setActive} />
      <div className="split" aria-live="polite">
        <Surface title={step.title}><p>{step.explanation}</p></Surface>
        <Surface title={['Excerpt from build.gradle.kts', 'Selected JAR entries', 'Build and smoke test'][active]}>
          <Code code={step.code} lang={step.lang} />
        </Surface>
      </div>
      <Surface title="Project layout">
        <Code code={projectTree} lang="text" />
      </Surface>
      <div className="lined">
        <h2>What still depends on the host</h2>
        <p>Check GraalPy support for packages with native extensions on every deployment target. Flask loads from the VFS inside the JAR, but the Python standard library is unpacked to a cache directory on first start, so the process needs a writable cache (2.2).</p>
      </div>
      <SourceLinks links={[['GraalPy build tools and virtual filesystem', buildDocs]]} />
    </Slide>
  );
}

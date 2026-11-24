import { Slide, Grid, Card, Code, Stat, StepControls, useStepper } from '@framework';
import { M, MB } from '../_shared/data.ts';
import { pomXml, linesBetween } from '../_shared/sources.ts';
import { Note, Measured, AutoScroll } from '../_shared/ui.tsx';
import './style.css';

const L = (a: string, b: string) => linesBetween(pomXml, a, b);
const venv = M.venv.installed;

// every file listed here exists in the real build output
const FILES: { path: string; step: number; note?: string }[] = [
  { path: 'target/graalpy.sh', step: 2, note: 'GraalPy launcher used only by the build' },
  { path: 'target/classes/org.graalvm.python.vfs/venv/pyvenv.cfg', step: 2, note: 'version = 3.12.8' },
  { path: 'target/classes/org.graalvm.python.vfs/venv/lib/python3.12/site-packages/', step: 3, note: `${venv.length} packages + pip` },
  { path: 'target/classes/org.graalvm.python.vfs/venv/installed.txt', step: 5, note: 'pip freeze' },
  { path: 'target/classes/org.graalvm.python.vfs/fileslist.txt', step: 5, note: `${M.venv.vfsFiles} entries` },
  { path: 'target/classes/META-INF/native-image/…/resource-config.json', step: 5, note: 'for Native Image' },
  { path: 'target/classes/org.graalvm.python.vfs/src/app.py', step: 4 },
  { path: 'target/classes/org.graalvm.python.vfs/src/wsgi_bridge.py', step: 4 },
  { path: 'target/classes/demo/Main.class', step: 6 },
  { path: 'target/original-flask-jar-1.0.jar', step: 7, note: MB(M.jar.thinSize) },
  { path: 'target/flask-jar-1.0.jar', step: 8, note: MB(M.jar.size) },
];

const STEPS = [
  { title: 'Resolve dependencies', pom: L('<dependencies>', '</dependencies>'), text: 'Maven downloads GraalPy from Maven Central like any library. python-community is a POM that pulls in the language (python-language, python-resources), Truffle and the polyglot API. python-embedding adds GraalPyResources. No Python installation is used or needed.' },
  { title: 'Create a venv with GraalPy', pom: L('<artifactId>graalpy-maven-plugin', '</executions>'), text: 'The graalpy-maven-plugin (goal process-graalpy-resources) runs GraalPy itself through a small launcher script and creates a virtual environment inside target/classes, so it will end up in the JAR. pyvenv.cfg records version = 3.12.8: the venv belongs to GraalPy, not to the host Python.' },
  { title: 'pip install the packages', pom: L('<packages>', '</packages>'), text: `pip, running on GraalPy, installs flask==${M.versions.flask} and resolves its dependencies: ${venv.map((p) => `${p.name} ${p.version}`).join(', ')}. Exact pins in <packages> make the build reproducible.` },
  { title: 'Copy the Python sources', pom: [], text: 'Ordinary Maven resource processing copies src/main/resources, which holds app.py and wsgi_bridge.py under org.graalvm.python.vfs/src/, into target/classes. That folder name is what puts them at /graalpy_vfs/src at run time.' },
  { title: 'Index the virtual filesystem', pom: L('<goal>process-graalpy-resources', '</goal>'), text: `A JAR has no directory listings, so the plugin writes fileslist.txt (${M.venv.vfsFiles.toLocaleString()} paths) for the VFS to answer os.listdir() and imports. installed.txt records what pip installed, and resource-config.json tells GraalVM Native Image to keep all of org.graalvm.python.vfs/ if you compile to a native binary later.` },
  { title: 'Compile Main.java', pom: L('<maven.compiler.release>', '</maven.compiler.release>'), text: 'javac compiles the single Java class. There is no code generation and no Python-to-Java translation: the Python stays Python source, executed at run time.' },
  { title: 'Package the thin JAR', pom: [], text: `The default jar step zips target/classes: our class, our Python, and the whole venv. ${MB(M.jar.thinSize)}, most of it pip itself (2.3). It cannot run alone, because GraalPy is not inside yet.` },
  { title: 'Shade into one runnable JAR', pom: L('<artifactId>maven-shade-plugin', '</plugin>'), text: `maven-shade-plugin unpacks every dependency into one JAR: ${MB(M.jar.size)}, ${M.jar.files.toLocaleString()} files. Two transformers matter. ServicesResourceTransformer merges the META-INF/services files (11 of them here) instead of letting one JAR’s copy overwrite another’s: Truffle finds its runtime and languages through these service files. ManifestResourceTransformer sets Main-Class and Multi-Release. Signature files are dropped because merged JARs can’t keep them.` },
];

export default function Page() {
  const st = useStepper(STEPS.length + 1, 2200);
  const s = st.step ? STEPS[st.step - 1] : null;
  const pomLines = pomXml.split('\n');
  const start = pomLines.findIndex((l) => l.includes('<properties>')) + 1;

  return (
    <Slide lead="mvn package is a normal Maven build with one extra plugin. Step through it: the left shows the part of pom.xml responsible, the right shows the files it leaves behind.">
      <Grid cols="1.05fr 1fr" gap={16}>
        <Card title="pom.xml" className="pom">
          <AutoScroll dep={st.step}><Code code={pomLines.slice(start - 1).join('\n')} lang="xml" active={s ? s.pom.map((l) => l - start + 1) : []} dim={Boolean(s?.pom.length)} /></AutoScroll>
        </Card>
        <div className="col">
          <Card title="target/ after this step">
            <div className="files">
              {FILES.filter((f) => f.step <= st.step).map((f) => (
                <div key={f.path} className={`file ${f.step === st.step ? 'is-new' : ''}`}>
                  <span>{f.path.replace('target/classes/org.graalvm.python.vfs/', 'target/classes/…vfs/')}</span>
                  {f.note && <span className="faint">{f.note}</span>}
                </div>
              ))}
              {st.step === 0 && <span className="faint">empty: press play</span>}
            </div>
          </Card>
          <Note tone="accent">{s ? <><b>{st.step}. {s.title}.</b> {s.text}</> : 'Eight things happen between mvn package and a runnable JAR.'}</Note>
        </div>
      </Grid>
      <StepControls stepper={st} label={`step ${st.step} / ${STEPS.length}`} />
      <Grid cols={3}>
        <Stat label="first build (incl. downloads)" value="166 s" tone="violet" />
        <Stat label="thin JAR → fat JAR" value={`${MB(M.jar.thinSize)} → ${MB(M.jar.size)}`} tone="blue" />
        <Stat label="files in the JAR" value={M.jar.files.toLocaleString()} tone="accent" />
      </Grid>
      <Measured>Build of the example on a clean ~/.m2, so the first build includes downloading GraalPy and Truffle. The order of the resource steps is simplified; the outputs are the real ones.</Measured>
    </Slide>
  );
}

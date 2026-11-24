import { useEffect } from 'react';
import { Slide, Grid, Card, Code, useStepper } from '@framework';
import { M, MB } from '../_shared/data.ts';
import { Label, Measured } from '../_shared/ui.tsx';
import './style.css';

const body = (r: string) => r.split(/\r?\n\r?\n/).slice(1).join('\n\n').trim();

const TREE = `flask-jar/
├── pom.xml                      dependencies + 2 plugins
└── src/main/
    ├── java/demo/Main.java      HTTP server → Python
    └── resources/org.graalvm.python.vfs/src/
        ├── app.py               the Flask app
        └── wsgi_bridge.py       request → WSGI call`;

const SESSION = [
  { cmd: 'mvn package', out: `# summarised: graalpy-maven-plugin creates a venv, pip-installs flask==${M.versions.flask}\n# maven-shade-plugin merges every dependency into one JAR\n→ target/flask-jar-1.0.jar  (${MB(M.jar.size)})` },
  { cmd: 'java -jar target/flask-jar-1.0.jar', out: 'Flask app imported in 5587 ms\nListening on http://localhost:8080' },
  { cmd: 'curl localhost:8080/', out: body(M.responses['get-root']) },
  { cmd: 'curl localhost:8080/info', out: M.responses.info.trim() },
];

export default function Cover() {
  const st = useStepper(SESSION.length + 1, 1500);
  const { step, atEnd, play, reset } = st;
  useEffect(() => {
    if (step === 0) play();
    if (atEnd) {
      const t = setTimeout(reset, 3500);
      return () => clearTimeout(t);
    }
  }, [step, atEnd, play, reset]);

  return (
    <Slide lead="Put the last two chapters together: a Maven project with a Flask app in its resources, a build that pip-installs Flask into the JAR, and a Java main() that serves HTTP by calling into Python. The result is one file you run with java -jar, with no Python installed on the machine.">
      <Grid cols="1fr 1.15fr" gap={18}>
        <div className="col">
          <div>
            <Label>the whole project: 4 source files</Label>
            <Code code={TREE} lang="text" />
          </div>
          <Card title="this chapter">
            <ol className="toc">
              <li><b>3.1</b> what <code>mvn package</code> does, step by step</li>
              <li><b>3.2</b> what is inside the {Math.round(M.jar.size / 1e6)} MB</li>
              <li><b>3.3</b> one HTTP request, from socket to Flask view and back</li>
              <li><b>3.4</b> who owns the socket, and threads</li>
              <li><b>3.5</b> what it costs: size, startup, speed</li>
            </ol>
          </Card>
        </div>
        <div className="term">
          {SESSION.map((s, i) => (
            <div key={i} className={`term-block ${step > i ? 'is-on' : ''}`}>
              <div className="term-cmd"><span>$</span> {s.cmd}</div>
              {step > i && <pre className="term-out">{s.out}</pre>}
            </div>
          ))}
          {step <= SESSION.length && <span className="cursor" />}
        </div>
      </Grid>
      <Measured>Commands and output are from the example project; the mvn output is summarised (startup line from one run; it ranged 5.6–13 s across runs). The python version in /info is GraalPy’s, not the host’s.</Measured>
    </Slide>
  );
}

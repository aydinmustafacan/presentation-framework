import { Slide, Grid, Card, Code, Tag } from '@framework';
import { pomXml, linesBetween, snippetOut } from '../_shared/sources.ts';
import { Label } from '../_shared/ui.tsx';
import './style.css';

const HELLO = `import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Value;

try (Context ctx = Context.create("python")) {
    Value r = ctx.eval("python", "sum(range(10))");
    System.out.println("sum=" + r.asInt());
}`;

const deps = linesBetween(pomXml, '<dependencies>', '</dependencies>');
const pomDeps = pomXml.split('\n').slice(deps[0] - 1, deps[deps.length - 1]).map((l) => l.replace(/^ {2}/, '')).join('\n');

const WAYS = [
  { title: 'Native standalone', tag: 'graalpy app.py', text: 'A downloadable `graalpy` executable that replaces `python`: venvs, pip, scripts. The Java side is compiled ahead of time, so it starts fast.', tone: 'muted' },
  { title: 'JVM standalone', tag: 'graalpy (JVM build)', text: 'The same launcher running on a JVM, with Java libraries reachable from Python via `import java`.', tone: 'muted' },
  { title: 'Embedded in Java', tag: 'Maven / Gradle', text: 'GraalPy as an ordinary library dependency of a Java application. This is the one we use: it is what lets a Flask app become a JAR.', tone: 'accent' },
] as const;

const tick = (s: string) => s.split('`').map((t, i) => (i % 2 ? <code key={i}>{t}</code> : t));

export default function Cover() {
  return (
    <Slide lead="To Java, GraalPy is a library. You add a dependency, create a Context and evaluate Python in it. Every Python object comes back as a Value you can call, index or convert. That is the entire integration surface, and it is all that a Flask-in-a-JAR needs.">
      <Grid cols={3}>
        {WAYS.map((w) => (
          <Card key={w.title} title={w.title} tone={w.tone} aside={<Tag tone={w.tone}>{w.tag}</Tag>}>
            <span className="muted">{tick(w.text)}</span>
          </Card>
        ))}
      </Grid>
      <Grid cols="minmax(0, 1.15fr) minmax(0, 1fr)" gap={18}>
        <div className="pomdeps">
          <Label>pom.xml: the whole dependency list of the example</Label>
          <Code code={pomDeps} lang="xml" />
        </div>
        <div className="col">
          <div>
            <Label>Java: the smallest useful embedding</Label>
            <Code code={HELLO} lang="java" />
          </div>
          <div>
            <Label>output (run against the example JAR)</Label>
            <Code code={snippetOut.split('\n')[0]} lang="text" />
          </div>
          <div className="terms">
            <div><b className="lane-java">Context</b> one isolated Python interpreter: its own <code>sys.modules</code>, globals and settings (file access, host access …).</div>
            <div><b className="lane-java">Value</b> a handle to any Python value: call it, index it, read members, convert with <code>asInt()</code>, <code>asString()</code> …</div>
            <div><b className="lane-java">Engine</b> optional, shared by several contexts so they can reuse each other's compiled code.</div>
          </div>
        </div>
      </Grid>
    </Slide>
  );
}

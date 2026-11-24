import { useState } from 'react';
import { Slide, Grid, Card, Code, Callout } from '@framework';
import { mainJava, bridgePy, lineOf, linesBetween } from '../_shared/sources.ts';
import { Note, Label, AutoScroll } from '../_shared/ui.tsx';
import './style.css';

const J = (s: string) => lineOf(mainJava, s);
const P = (s: string) => lineOf(bridgePy, s);

interface Crossing { id: string; dir: '→ Py' | '→ Java' | 'setup'; title: string; java: number[]; py: number[]; text: string }
const CROSSINGS: Crossing[] = [
  { id: 'ctx', dir: 'setup', title: 'Create the context', java: linesBetween(mainJava, 'Context python = GraalPyResources', '.build();'), py: [], text: 'GraalPyResources.contextBuilder() is a normal polyglot Context builder pre-configured to read Python files from the JAR (section 2.2). allowAllAccess(true) lets Python call Java methods. Without it, the map access below and app.py’s java.type(…) fail with “host lookup is not allowed” (verified in snippets/Snippet.java).' },
  { id: 'eval', dir: '→ Py', title: 'Evaluate, get a function back', java: [J('Value handle = python.eval')], py: [P('def handle(')], text: 'eval runs Python source and returns the value of the last expression, here the function object wsgi_bridge.handle. Java now holds a Value it can execute() like a lambda. Importing wsgi_bridge also imports app.py and Flask, which is the ~6 s of startup.' },
  { id: 'args', dir: '→ Py', title: 'Call it with Java arguments', java: linesBetween(mainJava, 'Value result = handle.execute(', 'body);'), py: [P('def handle(')], text: 'Arguments are not copied into Python objects. Java Strings arrive as real Python str, but the HashMap arrives as a ForeignDict and the byte[] as a ForeignList: Python-looking proxies around the Java objects (output of snippets/Snippet.java).' },
  { id: 'map', dir: '→ Java', title: 'Python calls Java methods', java: [J('Map<String, String> headers')], py: [P('for name in headers.keySet()'), P('value = headers.get(name)')], text: 'Because host access is allowed, Python can call the Java methods of the proxy directly: headers.keySet() and headers.get(name) are java.util.Map calls made from Python code.' },
  { id: 'bytes', dir: '→ Py', title: 'Copy the body into Python bytes', java: [J('byte[] body')], py: [P('"wsgi.input"')], text: 'bytes(body) iterates the foreign byte[] and builds a real Python bytes object, which io.BytesIO can wrap. WSGI needs a file-like object, so here a copy is the simplest correct choice.' },
  { id: 'wsgi', dir: 'setup', title: 'Plain WSGI inside Python', java: [], py: linesBetween(bridgePy, 'status_headers = []', 'chunks.close()'), text: 'From here on it is pure Python: the standard WSGI calling convention (PEP 3333). Flask does not know it was called from Java. Any WSGI app (Django, Falcon …) could sit behind the same bridge.' },
  { id: 'ret', dir: '→ Java', title: 'Return a tuple', java: linesBetween(mainJava, 'int status = result.getArrayElement(0)', 'h.getArrayElement(1).asString());'), py: [P('return int(status')], text: 'The Python tuple comes back as a Value with array elements: getArrayElement(0).asInt() is the status; the list of [name, value] lists is nested arrays. Nothing is converted until Java asks for it.' },
  { id: 'buf', dir: '→ Java', title: 'Read the payload as a buffer', java: linesBetween(mainJava, 'Value payload = result.getArrayElement(2)', 'payload.readBuffer('), py: [P('payload = b"".join(chunks)')], text: 'A Python bytes object exposes buffer elements to Java (hasBufferElements() is true), so readBuffer copies the whole response body into a Java byte[] in one call.' },
  { id: 'sync', dir: 'setup', title: 'One thread at a time', java: [J('private static synchronized void serve')], py: [], text: 'The HTTP server may call serve() from several threads, but this example has a single Context and serialises access with synchronized. Python inside GraalPy has a GIL anyway. To serve requests in parallel, use several contexts (a pool), ideally sharing one Engine.' },
];

export default function Page() {
  const [cur, setCur] = useState('args');
  const c = CROSSINGS.find((x) => x.id === cur)!;
  const jStart = J('public static void main');
  return (
    <Slide lead="Main.java and wsgi_bridge.py, the real files from the example, are the whole Java↔Python seam of the Flask JAR. Hover a crossing to see both sides of it.">
      <Grid cols="260px 1fr 1fr" gap={14}>
        <div className="crossings">
          {CROSSINGS.map((x) => (
            <button key={x.id} className={`crossing d-${x.dir === '→ Py' ? 'py' : x.dir === '→ Java' ? 'java' : 'setup'} ${cur === x.id ? 'is-on' : ''}`} onMouseEnter={() => setCur(x.id)} onClick={() => setCur(x.id)}>
              <span className="dir">{x.dir}</span>
              {x.title}
            </button>
          ))}
        </div>
        <Card title={<span className="lane-java">Main.java (host)</span>} className="pane">
          <AutoScroll dep={cur}><Code code={mainJava.split('\n').slice(jStart - 1).join('\n')} lang="java" active={c.java.map((l) => l - jStart + 1)} dim={c.java.length > 0} /></AutoScroll>
        </Card>
        <Card title={<span className="lane-py">wsgi_bridge.py (guest)</span>} className="pane">
          <AutoScroll dep={cur}><Code code={bridgePy} lang="py" active={c.py} dim={c.py.length > 0} /></AutoScroll>
        </Card>
      </Grid>
      <Note tone={c.dir === '→ Py' ? 'accent' : c.dir === '→ Java' ? 'blue' : undefined}>
        <b>{c.title}.</b> {c.text}
      </Note>
      <Callout tone="muted" title="Why not just run app.run()?">
        Flask’s own Werkzeug development server also works inside the JAR (it is the <code>--werkzeug</code> mode of the example, tested). Letting Java own the socket instead gives you Java’s HTTP stack, threads and monitoring, and keeps Python to what it is good at here: the application. Section 3.4 compares the two.
      </Callout>
      <Label>verified: what Python sees</Label>
      <div className="seen mono small">
        <span>Java String → <b>str</b></span>
        <span>java.util.Map → <b>ForeignDict</b></span>
        <span>byte[] → <b>ForeignList</b></span>
        <span>Python tuple → Value with <b>array elements</b></span>
        <span>Python bytes → Value with <b>buffer elements</b></span>
        <span>Python dict → Value with <b>hash entries</b></span>
      </div>
    </Slide>
  );
}

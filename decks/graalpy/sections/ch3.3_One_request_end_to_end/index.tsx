import { useMemo, useState } from 'react';
import { Slide, Grid, Card, Code, Segmented, StepControls, useStepper } from '@framework';
import { M } from '../_shared/data.ts';
import { mainJava, bridgePy, appPy, lineOf, linesBetween } from '../_shared/sources.ts';
import { Note, AutoScroll } from '../_shared/ui.tsx';
import './style.css';

const REQS = [
  { id: 'root', method: 'GET', path: '/', query: '', body: '', ctype: '', resp: 'get-root', view: linesBetween(appPy, '@app.get("/")', 'return "Hello'), viewName: 'index()' },
  { id: 'fib', method: 'GET', path: '/fib/90', query: '', body: '', ctype: '', resp: 'get-fib', view: linesBetween(appPy, '@app.get("/fib/<int:n>")', 'return jsonify(n=n, fib='), viewName: 'fib(n=90)' },
  { id: 'echo', method: 'POST', path: '/echo', query: '', body: '{"a":1}', ctype: 'application/json', resp: 'post-echo', view: linesBetween(appPy, '@app.post("/echo")', 'return jsonify(got='), viewName: 'echo()' },
  { id: '404', method: 'GET', path: '/nope', query: '', body: '', ctype: '', resp: 'get-404', view: [] as number[], viewName: null },
] as const;
type Req = (typeof REQS)[number];

type Lane = 'client' | 'java' | 'py';
interface Step { lane: Lane; file: 'java' | 'bridge' | 'app' | null; lines: number[]; title: string; text: (r: Req) => string; dir?: '→' | '←' }

const J = (a: string, b?: string) => (b ? linesBetween(mainJava, a, b) : [lineOf(mainJava, a)]);
const B = (a: string, b?: string) => (b ? linesBetween(bridgePy, a, b) : [lineOf(bridgePy, a)]);

const STEPS: Step[] = [
  { lane: 'client', file: null, lines: [], title: 'Request leaves curl', dir: '→', text: (r) => `${r.method} ${r.path} goes over TCP to port 8080. Nothing on the client side knows Python is involved.` },
  { lane: 'java', file: 'java', lines: J('server.createContext("/"'), title: 'JDK HTTP server accepts it', text: () => 'com.sun.net.httpserver, part of every JDK, parses the HTTP request and calls the handler registered for "/". No Python has run yet for this request.' },
  { lane: 'java', file: 'java', lines: J('private static synchronized void serve', 'byte[] body'), title: 'Collect headers and body', text: (r) => `serve() takes the single-context lock, copies the headers into a HashMap and reads the body: ${r.body ? `${r.body.length} bytes, ${r.body}` : '0 bytes'}.` },
  { lane: 'py', file: 'java', lines: J('Value result = handle.execute(', 'body);'), title: 'Cross into Python', dir: '→', text: () => 'handle.execute(…) calls the Python function wsgi_bridge.handle. The thread doesn’t change: the same Java thread now runs the GraalPy interpreter (or compiled code, once it is hot).' },
  { lane: 'py', file: 'bridge', lines: B('environ = {', 'environ["HTTP_" + key] = value'), title: 'Build the WSGI environ', text: (r) => `A plain dict per PEP 3333: REQUEST_METHOD=${r.method}, PATH_INFO=${r.path}${r.ctype ? `, CONTENT_TYPE=${r.ctype}` : ''}, HTTP_HOST, HTTP_USER_AGENT … and wsgi.input wrapping the body bytes.` },
  { lane: 'py', file: 'app', lines: [], title: 'Flask routes the request', text: (r) => (r.viewName ? `app(environ, start_response) enters Flask. Werkzeug’s URL map matches ${r.path} to the view ${r.viewName}${r.id === 'fib' ? ', converting "90" to an int on the way' : ''}.` : `No rule matches ${r.path}. Werkzeug raises NotFound, and Flask turns it into its standard 404 HTML page.`) },
  { lane: 'py', file: 'app', lines: [], title: 'The view runs', text: (r) => (r.id === 'root' ? 'index() returns a str; Flask wraps it in a text/html response.' : r.id === 'fib' ? 'fib(90) loops 90 times in Python and returns jsonify(…): a JSON response. The int is sent as a string because fib(90) is larger than a JavaScript number can hold exactly.' : r.id === 'echo' ? 'request.get_json() parses the body that arrived as a Java byte[] three steps ago. The view returns it as JSON.' : 'No view code runs; the 404 response is Flask’s default error handler.') },
  { lane: 'py', file: 'bridge', lines: B('status_headers = []', 'return int(status'), title: 'Collect the WSGI response', dir: '←', text: () => 'Flask calls start_response(status, headers) and returns an iterable of byte chunks. The bridge joins them and returns (status, headers, payload) to Java.' },
  { lane: 'java', file: 'java', lines: J('int status = result.getArrayElement(0)', 'os.write(out)'), title: 'Back in Java: write the response', text: () => 'Java unpacks the tuple through Value: asInt() for the status, nested arrays for headers, readBuffer() for the body bytes, then sends them with the JDK server.' },
  { lane: 'client', file: null, lines: [], title: 'Response arrives', dir: '←', text: () => 'Below is the real response captured from the running JAR (the JDK server capitalises header names its own way: Content-type).' },
];

export default function Page() {
  const [rid, setRid] = useState<Req['id']>('fib');
  const r = REQS.find((x) => x.id === rid)!;
  const st = useStepper(STEPS.length + 1, 1500);
  const s = st.step ? STEPS[st.step - 1] : null;
  const resp = M.responses[r.resp as keyof typeof M.responses];
  const respBody = resp.split(/\r?\n\r?\n/).slice(1).join('\n\n').trim();
  const respHead = resp.split(/\r?\n\r?\n/)[0].split(/\r?\n/).filter((l) => !l.startsWith('Date')).join('\n');

  const code = useMemo(() => {
    if (!s?.file) return null;
    if (s.file === 'app') return { title: 'app.py', src: appPy, lang: 'py' as const, lines: r.view };
    if (s.file === 'bridge') return { title: 'wsgi_bridge.py', src: bridgePy, lang: 'py' as const, lines: s.lines };
    return { title: 'Main.java', src: mainJava, lang: 'java' as const, lines: s.lines };
  }, [s, r]);

  const request = `${r.method} ${r.path} HTTP/1.1\nHost: localhost:8080\nUser-Agent: curl/…\nAccept: */*${r.body ? `\nContent-Type: ${r.ctype}\nContent-Length: ${r.body.length}\n\n${r.body}` : ''}`;

  return (
    <Slide lead="Follow one HTTP request through the running JAR: from the JDK's HTTP server, across into Python, through Flask, and back. Pick a request and step.">
      <div className="row">
        <Segmented value={rid} onChange={(v) => { setRid(v); st.reset(); }} options={REQS.map((x) => ({ value: x.id, label: <code>{x.method} {x.path}</code> }))} />
      </div>
      <div className="lanes">
        {(['client', 'java', 'py'] as Lane[]).map((l) => (
          <div key={l} className={`lane-box l-${l} ${s?.lane === l ? 'is-on' : ''}`}>
            <b>{l === 'client' ? 'curl' : l === 'java' ? 'Java: HttpServer + Main.serve' : 'Python: wsgi_bridge + Flask'}</b>
            <span>{l === 'client' ? 'outside the JVM' : l === 'java' ? 'host' : 'guest, same thread'}</span>
          </div>
        ))}
        <div className="dots">
          {STEPS.map((x, i) => (
            <span key={i} className={`dot l-${x.lane} ${st.step === i + 1 ? 'is-on' : ''} ${st.step > i + 1 ? 'is-past' : ''}`} onClick={() => st.goTo(i + 1)} title={x.title} />
          ))}
        </div>
      </div>
      <Grid cols="1fr 1.2fr" gap={16}>
        <div className="col">
          <Note tone={s?.lane === 'py' ? 'accent' : s?.lane === 'java' ? 'blue' : undefined}>
            {s ? <><b>{st.step}. {s.title}.</b> {s.text(r)}</> : 'Ten steps, two languages, one thread. Press play.'}
          </Note>
          {(!s || st.step <= 2) && <Card title="request"><Code code={request} lang="text" /></Card>}
          {st.step === STEPS.length && (
            <Card title="response (real)" tone="green">
              <Code code={`${respHead}\n\n${respBody}`} lang="text" />
            </Card>
          )}
        </div>
        <Card title={code ? code.title : '—'} className="src">
          {code ? (
            code.lines.length || code.title !== 'app.py' ? (
              <AutoScroll dep={`${st.step}-${rid}`}><Code code={code.src} lang={code.lang} active={code.lines} dim /></AutoScroll>
            ) : (
              <Code code={code.src} lang="py" />
            )
          ) : (
            <div className="faint">outside the application</div>
          )}
        </Card>
      </Grid>
      <StepControls stepper={st} label={`step ${st.step} / ${STEPS.length}`} />
    </Slide>
  );
}

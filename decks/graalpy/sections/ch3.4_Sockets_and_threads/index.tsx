import { useState } from 'react';
import { Slide, Grid, Card, Code, Stat, Tag, Callout } from '@framework';
import { M, sec, steady } from '../_shared/data.ts';
import { mainJava, lineOf } from '../_shared/sources.ts';
import { Note, Label } from '../_shared/ui.tsx';
import './style.css';

const optA = mainJava.split('\n')[lineOf(mainJava, 'python.eval("python", "from app import app; app.run(') - 1].trim();
const WERKZEUG_LOG = ` * Serving Flask app 'app'
 * Debug mode: off
WARNING: This is a development server. Do not use it in a production
deployment. Use a production WSGI server instead.
 * Running on http://127.0.0.1:8768
127.0.0.1 - - [23/Nov/2026 22:47:07] "GET / HTTP/1.1" 200 -
127.0.0.1 - - [23/Nov/2026 22:47:07] "GET /info HTTP/1.1" 200 -`;

const OPTB = `HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
server.createContext("/", exchange -> serve(python, handle, exchange));`;

const PER_REQ = steady(M.bench.graalvm.ms); // measured warm cost of one /primes request

export default function Page() {
  const [n, setN] = useState(12);
  const [k, setK] = useState(1);
  // model: n requests arrive together; k contexts each serve one at a time; enough CPU cores for k
  const done = Array.from({ length: n }, (_, i) => (Math.floor(i / k) + 1) * PER_REQ);
  const worst = done[done.length - 1];
  const p50 = done[Math.floor((n - 1) / 2)];

  return (
    <Slide lead="Something has to own the listening socket. In the JAR, Python can (Flask’s own server) or Java can (what the example does). Both work; they differ in who handles threads.">
      <Grid cols="1fr 1fr" gap={16}>
        <Card title="A · Python owns the socket" aside={<Tag tone="accent">java -jar … 8080 --werkzeug</Tag>}>
          <Code code={optA} lang="java" />
          <Label style={{ marginTop: 10 }}>real output from the JAR</Label>
          <Code code={WERKZEUG_LOG} lang="text" className="log" />
          <p className="muted small">Werkzeug opens the socket through GraalPy’s POSIX layer and serves requests itself. It is the quickest way to try an app, and Flask says it is not for production.</p>
        </Card>
        <Card title="B · Java owns the socket" aside={<Tag tone="blue">the example’s default</Tag>} tone="blue">
          <Code code={OPTB} lang="java" />
          <p className="muted small">The JDK’s HTTP server (or Jetty, Netty, Spring, Micronaut …) accepts connections, and each request becomes one WSGI call (3.3). Java owns threading, TLS, timeouts and metrics, and Python only runs application code.</p>
          <Note tone="blue">
            The catch: <b>one Context runs Python on one thread at a time</b>. The example has a single context and a <code>synchronized</code> serve(), so concurrent requests queue. To serve in parallel, give each worker thread its own Context, ideally created from one shared Engine.
          </Note>
        </Card>
      </Grid>
      <Card title="model: concurrent requests vs contexts">
        <Grid cols="300px 1fr" gap={20}>
          <div className="col">
            <label className="slider">
              <span>requests arriving at once: <b>{n}</b></span>
              <input type="range" min={1} max={32} value={n} onChange={(e) => setN(+e.target.value)} />
            </label>
            <label className="slider">
              <span>contexts in the pool: <b>{k}</b></span>
              <input type="range" min={1} max={8} value={k} onChange={(e) => setK(+e.target.value)} />
            </label>
            <Grid cols={2} gap={8}>
              <Stat label="median finish time" value={sec(p50)} tone="accent" />
              <Stat label="last one finishes" value={sec(worst)} tone={k === 1 && n > 4 ? 'red' : 'green'} />
            </Grid>
          </div>
          <div className="q">
            {done.map((t, i) => (
              <div key={i} className="q-row">
                <span className="faint mono">#{i + 1}</span>
                <div className="q-bar" style={{ width: `${(t / Math.max(32 * PER_REQ, 1)) * 100}%` }}>
                  <span style={{ width: `${(PER_REQ / t) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Grid>
        <Note>
          Each bar is one request: the dark end is its own {sec(PER_REQ)} of work (the measured warm /primes time on GraalVM), the rest is waiting for a free context. This is a queueing model, not a benchmark: it assumes a free CPU core per context and ignores that every new context has to import Flask and warm up first.
        </Note>
      </Card>
      <Callout tone="muted" title="Threads inside Python">
        GraalPy has a global interpreter lock like CPython, so Python threads started inside one context take turns. Parallelism comes from several contexts, not from Python threads.
      </Callout>
    </Slide>
  );
}

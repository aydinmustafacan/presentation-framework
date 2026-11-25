import { Slide } from '@framework';
import { buildDocs, flaskDocs, jepDocs, jythonDocs } from '../_shared/demo.ts';
import { SourceLinks, Surface } from '../_shared/ui.tsx';

export default function Conclusion() {
  return (
    <Slide title="GraalPy best fits the JAR deployment" lead="Start with GraalPy. It ran modern Flask in the repo’s runnable JAR and gives the Java service control of HTTP and process lifecycle.">
      <div className="surface matrix-wrap" role="region" aria-label="Runtime comparison" tabIndex={0}>
        <table className="fit-table">
          <caption>Fit against the service requirements</caption>
          <thead>
            <tr><th scope="col">Requirement</th><th scope="col" className="recommended">GraalPy</th><th scope="col">Jython</th><th scope="col">JEP</th></tr>
          </thead>
          <tbody>
            <tr><th scope="row">Modern Flask</th><td className="recommended">Verified with Flask 3.1.3 in the demo</td><td>Python 2.7 blocks Flask 3.1</td><td>Compatible CPython can run Flask</td></tr>
            <tr><th scope="row">Runnable JAR</th><td className="recommended">Java host, GraalPy and app resources bundled</td><td>JVM-friendly packaging for Python 2.7 code</td><td>Requires provisioning CPython and native JEP components</td></tr>
            <tr><th scope="row">Work to validate</th><td className="recommended">Dependency support, target JDK and context concurrency</td><td>Python 3 support required for this app</td><td>Target ABI, native dependencies and interpreter threading</td></tr>
          </tbody>
        </table>
      </div>
      <Surface title="Pilot one representative endpoint">
        <ol className="pilot-list">
          <li>Wire one real Flask route into the existing Java service host, with its usual configuration, logging, health checks and shutdown.</li>
          <li>Build the runnable JAR in CI and launch it in the production base image. Verify dependency imports, runtime permissions and the usual deployment and rollback commands.</li>
          <li>Compare startup, memory, p95 latency and error behavior against the service’s existing limits under representative load. Revisit JEP if a required dependency needs CPython.</li>
        </ol>
      </Surface>
      <SourceLinks links={[
        ['GraalPy packaging', buildDocs],
        ['Flask requirements', flaskDocs],
        ['Jython runtime', jythonDocs],
        ['JEP runtime', jepDocs],
      ]} />
    </Slide>
  );
}

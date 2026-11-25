import { Slide } from '@framework';
import { M } from '../../../graalpy/sections/_shared/data.ts';
import vfsCheck from '../../../graalpy/example/flask-jar/snippets/VfsCheck.out?raw';
import { Surface } from '../_shared/ui.tsx';
import './style.css';

// Real values: sys.path / file locations from the example app's /where route, the write attempt from snippets/VfsCheck.java.
const W: { app: string; flask: string; json: string } = JSON.parse(M.responses.where);
const writeError = (vfsCheck.split('\n').find((l) => l.startsWith('write into VFS:')) ?? '').replace('write into VFS: ', '').split(' [')[0];
const cacheDir = W.json.split('/python/python-home/')[0] + '/';

const MAP = [
  { jar: 'org.graalvm.python.vfs/src/app.py', py: W.app, what: 'your code, first on sys.path' },
  { jar: 'org.graalvm.python.vfs/venv/…/site-packages/flask/', py: W.flask.replace('__init__.py', ''), what: 'pip packages, installed at build time' },
];

export default function Page() {
  return (
    <Slide lead="A JAR is a zip, but Python expects real files. GraalPy’s virtual filesystem (VFS) makes the JAR’s resources look like a read-only directory, /graalpy_vfs, so import and open() work unchanged.">
      <div className="matrix-wrap">
        <table className="fit-table vfs-map">
          <thead>
            <tr><th>Stored in the JAR</th><th></th><th>Python sees</th><th>What it is</th></tr>
          </thead>
          <tbody>
            {MAP.map((r) => (
              <tr key={r.jar}>
                <td><code>{r.jar}</code></td>
                <td className="vfs-arrow">→</td>
                <td><code>{r.py}</code></td>
                <td>{r.what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="vfs-facts">
        <Surface title="Reads just work">
          <p><code>import</code>, <code>open()</code> and <code>os.listdir()</code> are the normal Python APIs. The app needs no code changes to run from the JAR.</p>
        </Surface>
        <Surface title="Writes fail">
          <p>The VFS is read-only: writing to it raises <code>{writeError}</code>. Keep data such as <code>todos.json</code> on the host disk.</p>
        </Surface>
        <Surface title="The stdlib is unpacked">
          <p>GraalPy’s own standard library is also in the JAR, but it is unpacked once to a cache directory (<code>{cacheDir}</code> on macOS). The process needs write access there.</p>
        </Surface>
      </div>
      <p className="small-note">Paths and the error come from running the example JAR (decks/graalpy/example/flask-jar).</p>
    </Slide>
  );
}

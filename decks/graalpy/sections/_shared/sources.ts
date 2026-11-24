/** The example project's real source files, imported as text (Vite `?raw`), so slides never drift from the code. */
import mainJava from '../../example/flask-jar/src/main/java/demo/Main.java?raw';
import appPy from '../../example/flask-jar/src/main/resources/org.graalvm.python.vfs/src/app.py?raw';
import bridgePy from '../../example/flask-jar/src/main/resources/org.graalvm.python.vfs/src/wsgi_bridge.py?raw';
import pomXml from '../../example/flask-jar/pom.xml?raw';

export { mainJava, appPy, bridgePy, pomXml };

/** 1-based line number of the first line containing `needle` (throws if missing, so a code change fails the build loudly). */
export function lineOf(code: string, needle: string, from = 1): number {
  const lines = code.split('\n');
  for (let i = from - 1; i < lines.length; i++) if (lines[i].includes(needle)) return i + 1;
  throw new Error(`"${needle}" not found in source`);
}

/** Inclusive range of lines from the first containing `a` to the next containing `b`. */
export function linesBetween(code: string, a: string, b: string): number[] {
  const s = lineOf(code, a);
  const e = lineOf(code, b, s);
  return Array.from({ length: e - s + 1 }, (_, i) => s + i);
}

import snippetJava from '../../example/flask-jar/snippets/Snippet.java?raw';
import snippetOut from '../../example/flask-jar/snippets/Snippet.out?raw';
export { snippetJava, snippetOut };

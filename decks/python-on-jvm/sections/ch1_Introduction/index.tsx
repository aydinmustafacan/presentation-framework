import { Slide } from '@framework';
import '../_shared/deck.css';

const chapters = [
  ['ch1.1', 'Python origins and runtimes', 'From CPython and Jython to the JNI bridge'],
  ['ch1.2', 'From Java to bytecode', 'What javac turns everyday Java into'],
  ['ch1.3', 'JVM foundations', 'Bytecode, frames and the operand stack'],
  ['ch1.4', 'GraalPy, Jython or JEP?', 'Explore the three runtime stacks side by side'],
  ['ch2', 'GraalPy', 'Embed Flask, build the JAR and follow a request'],
  ['ch3', 'Jython', 'JVM bytecode and the Python 2 constraint'],
  ['ch4', 'JEP', 'CPython in the Java process via JNI'],
  ['ch5', 'Conclusion', 'Choose a pilot for the Flask service'],
] as const;

function sectionLink(id: string) {
  if (window.parent !== window) {
    try {
      return new URL(`#${id}`, window.parent.location.href).href;
    } catch {
      // In an offline srcdoc iframe fragment links resolve against the shell.
      if (window.location.href === 'about:srcdoc') return `#${id}`;
    }
  }
  return `./${id}.html`;
}

export default function Introduction() {
  return (
    <Slide
      title="Python on the JVM"
      lead="Can we write a microservice backend in Flask and ship it through the same JAR-based release pipeline as our Java services?"
    >
      <div className="split">
        <section className="surface release-board" aria-label="Target deployment">
          <h2>What we want to ship</h2>
          <div className="layer guest">
            <strong>Flask routes + business logic</strong>
            <small>Author the backend in Python</small>
          </div>
          <div className="layer boundary">
            <strong>Java entry point + Python runtime</strong>
            <small>Connect Python to the Java service host</small>
          </div>
          <div className="layer artifact">
            <strong>service.jar</strong>
            <small>Publish, launch and roll back through the existing workflow</small>
          </div>
          <p className="deploy mono-note">java -jar service.jar</p>
        </section>
        <nav className="deck-toc" aria-label="Table of contents">
          <h2>Table of contents</h2>
          <ol>
            {chapters.map(([id, name, description]) => (
              <li key={id}><a href={sectionLink(id)} target="_parent"><strong>{name}</strong><small>{description}</small></a></li>
            ))}
          </ol>
        </nav>
      </div>
      <p className="padded-note">The release contract is a runnable JAR. We’ll examine what each option executes, what the JAR contains, and what the deployment host has to provide.</p>
    </Slide>
  );
}

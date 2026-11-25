import type { ReactNode } from 'react';
import './deck.css';

export function Surface({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="surface">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

type Stage = { label: string; detail?: string; tone?: 'artifact' | 'guest' | 'boundary' };

export function Flow({ stages, selected, onSelect }: {
  stages: readonly Stage[];
  selected?: number;
  onSelect?: (index: number) => void;
}) {
  return (
    <ol className="flow" aria-label="Execution order">
      {stages.map(({ label, detail, tone }, index) => {
        const className = ['flow-node', tone].filter(Boolean).join(' ');
        const content = <>{label}{detail && <small>{detail}</small>}</>;
        return (
          <li key={label}>
            {onSelect ? (
              <button type="button" className={className} aria-pressed={selected === index} onClick={() => onSelect(index)}>
                {content}
              </button>
            ) : <div className={className}>{content}</div>}
          </li>
        );
      })}
    </ol>
  );
}

export function SourceLinks({ links }: { links: ReadonlyArray<readonly [string, string]> }) {
  return (
    <p className="source-links">
      {links.map(([label, href]) => <a key={href} href={href} target="_blank" rel="noreferrer">{label}</a>)}
    </p>
  );
}

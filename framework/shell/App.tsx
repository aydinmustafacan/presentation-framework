import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Manifest, Section } from '../sections.ts';

type PublicSection = Omit<Section, 'source'>;
type PublicManifest = Omit<Manifest, 'sections'> & { sections: PublicSection[] };

declare global {
  interface Window {
    /** Set by the single-file build (dist/presentation.html). */
    __PRESENTATION__?: { manifest: PublicManifest; pages: Record<string, string> };
  }
}

const embedded = window.__PRESENTATION__;

function useManifest() {
  const [manifest, setManifest] = useState<PublicManifest | null>(embedded?.manifest ?? null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (embedded) return;
    fetch('./manifest.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`manifest.json: HTTP ${r.status}`))))
      .then(setManifest)
      .catch((e: Error) => setError(e.message));
  }, []);
  return { manifest, error };
}

function readHash() {
  return decodeURIComponent(location.hash.replace(/^#\/?/, ''));
}

function useStoredBool(key: string, initial: boolean) {
  const [v, setV] = useState(() => {
    const s = localStorage.getItem(key);
    return s === null ? initial : s === '1';
  });
  useEffect(() => localStorage.setItem(key, v ? '1' : '0'), [key, v]);
  return [v, setV] as const;
}

type Theme = 'light' | 'dark';

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'));
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('presentation.theme', theme);
    } catch {
      /* storage may be unavailable (file://, privacy mode) */
    }
  }, [theme]);
  return [theme, setTheme] as const;
}

export default function App() {
  const { manifest, error } = useManifest();
  const [theme, setTheme] = useTheme();
  const [hash, setHash] = useState(readHash);
  const [sidebar, setSidebar] = useStoredBool('presentation.sidebar', window.innerWidth > 900);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const on = () => setHash(readHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const sections = manifest?.sections ?? [];
  const index = Math.max(0, sections.findIndex((s) => s.id === hash || s.number === hash));
  const current = sections[index];

  useEffect(() => {
    if (manifest) document.title = current ? `${current.number} ${current.title} · ${manifest.title}` : manifest.title;
  }, [manifest, current]);

  const go = useCallback(
    (i: number) => {
      const s = sections[Math.min(sections.length - 1, Math.max(0, i))];
      if (s) location.hash = `#${s.id}`;
    },
    [sections],
  );

  const onKey = useCallback(
    (key: string) => {
      switch (key) {
        case 'ArrowRight':
        case 'PageDown':
          return go(index + 1);
        case 'ArrowLeft':
        case 'PageUp':
          return go(index - 1);
        case 'Home':
          return go(0);
        case 'End':
          return go(sections.length - 1);
        case 's':
          return setSidebar((v) => !v);
        case 't':
          return setTheme((v) => (v === 'light' ? 'dark' : 'light'));
        case 'f':
          return document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
      }
    },
    [go, index, sections.length, setSidebar, setTheme],
  );

  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === ' ' || e.key === '.' || e.key === ',') {
        // page-widget keys pressed while the shell has focus: hand them to the page
        const win = frameRef.current?.contentWindow;
        if (win) {
          e.preventDefault();
          win.focus();
          win.dispatchEvent(new KeyboardEvent('keydown', { key: e.key, bubbles: true, cancelable: true }));
        }
        return;
      }
      onKey(e.key);
    };
    const message = (e: MessageEvent) => {
      if (e.source === frameRef.current?.contentWindow && e.data?.__presentation === 'key') onKey(e.data.key);
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('message', message);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('message', message);
    };
  }, [onKey]);

  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage({ __presentation: 'theme', theme }, '*');
  }, [theme]);

  const grouped = useMemo(
    () =>
      (manifest?.chapters ?? []).map((c) => ({
        chapter: c,
        items: sections.filter((s) => s.parts[0] === c.number && s.parts.length > 1),
      })),
    [manifest, sections],
  );

  if (error) return <div className="shell-message">Could not load the presentation: {error}</div>;
  if (!manifest) return <div className="shell-message">Loading…</div>;
  if (!current)
    return (
      <div className="shell-message">
        No sections yet. Add a folder like <code>sections/ch1.1_Intro/index.tsx</code> or drop a file like{' '}
        <code>sections/ch1.2_Something.html</code>.
      </div>
    );

  const chapter = manifest.chapters.find((c) => c.number === current.parts[0]);
  const progress = ((index + 1) / sections.length) * 100;

  return (
    <div className={`shell ${sidebar ? 'with-sidebar' : ''}`}>
      <aside className="sidebar" aria-label="Sections">
        <header className="sidebar-head">
          <div className="deck-title">{manifest.title}</div>
          {manifest.subtitle && <div className="deck-subtitle">{manifest.subtitle}</div>}
        </header>
        <nav className="toc">
          {grouped.map(({ chapter: c, items }) => {
            const chapterActive = current.parts[0] === c.number;
            return (
              <section key={c.number} className={`toc-chapter ${chapterActive ? 'is-open' : ''}`}>
                {c.pageId ? (
                  <a href={`#${c.pageId}`} className={`toc-chapter-title ${current.id === c.pageId ? 'is-active' : ''}`}>
                    <span className="toc-num">{c.number}</span>
                    {c.title}
                  </a>
                ) : (
                  <div className="toc-chapter-title">
                    <span className="toc-num">{c.number}</span>
                    {c.title}
                  </div>
                )}
                {items.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className={`toc-item ${s.id === current.id ? 'is-active' : ''}`}
                    style={{ paddingLeft: 20 + (s.parts.length - 2) * 14 }}
                    aria-current={s.id === current.id ? 'page' : undefined}
                  >
                    <span className="toc-num">{s.number}</span>
                    <span className="toc-label">{s.title}</span>
                    {s.kind === 'html' && <span className="toc-tag" title="Dropped-in HTML page">html</span>}
                  </a>
                ))}
              </section>
            );
          })}
        </nav>
        <footer className="sidebar-foot">
          <kbd>←</kbd><kbd>→</kbd> move · <kbd>S</kbd> sidebar · <kbd>T</kbd> theme · <kbd>F</kbd> full
        </footer>
      </aside>

      <main className="stage">
        <div className="topbar">
          <button className="icon-btn" onClick={() => setSidebar((v) => !v)} title="Toggle sidebar (S)" aria-label="Toggle sidebar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16" />
            </svg>
          </button>
          <div className="crumbs">
            {chapter && current.parts.length > 1 && <span className="crumb-chapter">{chapter.title}</span>}
            <span className="crumb-num">{current.number}</span>
            <span className="crumb-title">{current.title}</span>
          </div>
          <div className="nav">
            <button className="icon-btn" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous section">
              ‹
            </button>
            <span className="counter">
              {index + 1} / {sections.length}
            </span>
            <button className="icon-btn" onClick={() => go(index + 1)} disabled={index === sections.length - 1} aria-label="Next section">
              ›
            </button>
            <button
              className="icon-btn"
              onClick={() => onKey('t')}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode (T)`}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              )}
            </button>
            <button className="icon-btn" onClick={() => onKey('f')} title="Fullscreen (F)" aria-label="Fullscreen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
              </svg>
            </button>
          </div>
          <div className="progress" style={{ width: `${progress}%` }} />
        </div>
        <iframe
          ref={frameRef}
          key={current.id}
          data-theme={theme}
          className="frame"
          title={`${current.number} ${current.title}`}
          src={embedded ? undefined : `./pages/${current.id}.html`}
          srcDoc={embedded ? embedded.pages[current.id] : undefined}
          onLoad={(e) => e.currentTarget.contentWindow?.focus()}
        />
      </main>
    </div>
  );
}

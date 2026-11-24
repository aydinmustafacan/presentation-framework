/**
 * Section discovery.
 *
 * Everything inside `sections/` whose name matches `ch<number>_<title>` becomes a page:
 *
 *   sections/ch1_Introduction/index.tsx      -> React page, section "1"   (chapter cover)
 *   sections/ch1.1_What_is_the_JVM/index.tsx -> React page, section "1.1"
 *   sections/ch2.3_Some_page.html            -> pre-built standalone HTML page, section "2.3"
 *
 * Numbers can be nested arbitrarily deep (ch1.2.3_...). A depth-1 number (ch1_...) is the
 * chapter's own page and its title becomes the chapter title in the sidebar.
 */
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');
/**
 * Which deck to work on. Default: the project root (./sections + ./presentation.json).
 * Set DECK=decks/<name> to work on another deck: decks/<name>/sections + decks/<name>/presentation.json.
 */
export const DECK = process.env.DECK ? path.resolve(ROOT, process.env.DECK) : ROOT;
export const DECK_NAME = DECK === ROOT ? '' : path.basename(DECK);
export const SECTIONS_DIR = path.join(DECK, 'sections');
export const CONFIG_FILE = path.join(DECK, 'presentation.json');
export const CACHE_DIR = path.join(ROOT, '.presentation', DECK_NAME || '_root');
export const DIST_DIR = path.join(ROOT, 'dist', DECK_NAME);

const NAME_RE = /^ch(\d+(?:\.\d+)*)_(.+?)(\.html?)?$/i;
const REACT_ENTRIES = ['index.tsx', 'index.jsx', 'Page.tsx'];

export type SectionKind = 'react' | 'html';

export interface Section {
  /** "1.2" */
  number: string;
  /** [1, 2] — used for sorting */
  parts: number[];
  /** "ch1.2" — stable, URL-safe id; also the output file name */
  id: string;
  title: string;
  kind: SectionKind;
  /** absolute path to the React entry or the .html file */
  source: string;
}

export interface Chapter {
  number: number;
  title: string;
  /** id of the chapter cover page (ch1_...), if any */
  pageId?: string;
}

export interface Manifest {
  title: string;
  subtitle?: string;
  chapters: Chapter[];
  sections: Section[];
}

interface Config {
  title?: string;
  subtitle?: string;
  chapters?: Record<string, string>;
}

export function readConfig(): Config {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) as Config;
}

export function titleFromName(raw: string): string {
  // Underscores become spaces; hyphens are kept ("Stack-based_VMs" -> "Stack-based VMs").
  const t = raw.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function compareParts(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? -1;
    const y = b[i] ?? -1;
    if (x !== y) return x - y;
  }
  return 0;
}

export function discoverSections(): Section[] {
  if (!fs.existsSync(SECTIONS_DIR)) return [];
  const out: Section[] = [];
  const seen = new Map<string, string>();

  for (const entry of fs.readdirSync(SECTIONS_DIR, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
    const m = NAME_RE.exec(entry.name);
    if (!m) {
      console.warn(`[presentation] ignoring "${entry.name}" — expected ch<n>[.<n>...]_<title>`);
      continue;
    }
    const [, number, rawTitle, ext] = m;
    const full = path.join(SECTIONS_DIR, entry.name);
    let kind: SectionKind;
    let source: string;

    if (entry.isDirectory() && !ext) {
      const file = REACT_ENTRIES.find((f) => fs.existsSync(path.join(full, f)));
      if (file) {
        kind = 'react';
        source = path.join(full, file);
      } else if (fs.existsSync(path.join(full, 'index.html'))) {
        kind = 'html';
        source = path.join(full, 'index.html');
      } else {
        console.warn(`[presentation] "${entry.name}" has no index.tsx or index.html — skipped`);
        continue;
      }
    } else if (entry.isFile() && ext) {
      kind = 'html';
      source = full;
    } else {
      continue;
    }

    if (seen.has(number)) {
      throw new Error(`[presentation] section ${number} is defined twice: "${seen.get(number)}" and "${entry.name}"`);
    }
    seen.set(number, entry.name);

    out.push({
      number,
      parts: number.split('.').map(Number),
      id: `ch${number}`,
      title: titleFromName(rawTitle),
      kind,
      source,
    });
  }

  return out.sort((a, b) => compareParts(a.parts, b.parts));
}

export function buildManifest(): Manifest {
  const config = readConfig();
  const sections = discoverSections();
  const chapterNums = [...new Set(sections.map((s) => s.parts[0]))].sort((a, b) => a - b);

  const chapters: Chapter[] = chapterNums.map((n) => {
    const cover = sections.find((s) => s.parts.length === 1 && s.parts[0] === n);
    return {
      number: n,
      title: config.chapters?.[String(n)] ?? cover?.title ?? `Chapter ${n}`,
      pageId: cover?.id,
    };
  });

  return {
    title: config.title ?? 'Presentation',
    subtitle: config.subtitle,
    chapters,
    sections,
  };
}

/** What the browser gets — no absolute file paths. */
export function publicManifest(m: Manifest) {
  return {
    ...m,
    sections: m.sections.map(({ source: _s, ...rest }) => rest),
  };
}

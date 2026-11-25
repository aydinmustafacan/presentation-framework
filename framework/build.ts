/**
 * Production build.
 *
 *   dist/pages/ch1.1.html   every section as ONE self-contained HTML file (JS + CSS inlined)
 *   dist/index.html         the navigation shell (loads manifest.json + pages/ over HTTP)
 *   dist/manifest.json
 *   dist/presentation.html  shell + every page embedded — a single file you can double-click,
 *                           email or put on a USB stick. Works from file:// with no server.
 */
import fs from 'node:fs';
import path from 'node:path';
import { build, type InlineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { buildManifest, publicManifest, CACHE_DIR, DIST_DIR, ROOT, type Section } from './sections.ts';
import { entryDir, injectBridge, safeJson, writeReactEntry } from './pages.ts';
import { frameworkAlias } from './vite-plugin.ts';

const DIST = DIST_DIR;
const CONCURRENCY = 4;

function singleFileConfig(root: string, outDir: string): InlineConfig {
  return {
    configFile: false,
    root,
    base: './',
    logLevel: 'warn',
    plugins: [react(), viteSingleFile({ removeViteModuleLoader: true })],
    resolve: { alias: frameworkAlias },
    build: { outDir, emptyOutDir: true, reportCompressedSize: false, chunkSizeWarningLimit: 4096 },
  };
}

async function buildReactSection(s: Section): Promise<string> {
  writeReactEntry(s);
  const dir = entryDir(s);
  const out = path.join(dir, 'dist');
  await build(singleFileConfig(dir, out));
  return fs.readFileSync(path.join(out, 'index.html'), 'utf8');
}

async function buildSection(s: Section): Promise<[string, string]> {
  const t = performance.now();
  const html = s.kind === 'react' ? await buildReactSection(s) : fs.readFileSync(s.source, 'utf8');
  const final = injectBridge(html);
  fs.writeFileSync(path.join(DIST, 'pages', `${s.id}.html`), final);
  const kb = (Buffer.byteLength(final) / 1024).toFixed(0).padStart(5);
  console.log(`  ✓ ${s.id.padEnd(8)} ${s.kind.padEnd(5)} ${kb} kB  ${(performance.now() - t).toFixed(0).padStart(5)} ms  ${s.title}`);
  return [s.id, final];
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

async function main() {
  const started = performance.now();
  const manifest = buildManifest();
  if (manifest.sections.length === 0) {
    console.error('No sections found in ./sections — nothing to build.');
    process.exit(1);
  }

  // clean only this deck's own output: dist/ also holds other decks' folders
  for (const f of ['pages', 'index.html', 'manifest.json', 'presentation.html']) fs.rmSync(path.join(DIST, f), { recursive: true, force: true });
  fs.mkdirSync(path.join(DIST, 'pages'), { recursive: true });
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  console.log(`\nBuilding ${manifest.sections.length} sections of "${manifest.title}"\n`);
  const pages = Object.fromEntries(await pool(manifest.sections, CONCURRENCY, buildSection));

  // Shell
  const shellOut = path.join(CACHE_DIR, '_shell');
  await build(singleFileConfig(ROOT, shellOut));
  const shellHtml = fs.readFileSync(path.join(shellOut, 'index.html'), 'utf8');
  const pub = publicManifest(manifest);
  fs.writeFileSync(path.join(DIST, 'index.html'), shellHtml);
  fs.writeFileSync(path.join(DIST, 'manifest.json'), JSON.stringify(pub, null, 2));

  // Everything in one file
  const embedded = `<script>window.__PRESENTATION__=${safeJson({ manifest: pub, pages })};</script>`;
  // A callback keeps dollar-sign sequences in the embedded pages literal.
  const single = shellHtml.replace(/<head>/i, (head) => head + embedded);
  fs.writeFileSync(path.join(DIST, 'presentation.html'), single);

  const mb = (Buffer.byteLength(single) / 1024 / 1024).toFixed(2);
  const rel = path.relative(ROOT, DIST);
  console.log(`\n  ${rel}/index.html          shell (serve ${rel}/ over HTTP)`);
  console.log(`  ${rel}/presentation.html   ${mb} MB, fully self-contained`);
  console.log(`\nDone in ${((performance.now() - started) / 1000).toFixed(1)} s\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

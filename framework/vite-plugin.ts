/**
 * Dev-server plugin: serves the shell, a live manifest and every section page with HMR.
 *
 *   GET /manifest.json        -> sections discovered right now
 *   GET /pages/<id>.html      -> React section (through Vite, with HMR) or dropped-in HTML file
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { buildManifest, publicManifest, SECTIONS_DIR, CONFIG_FILE, ROOT } from './sections.ts';
import { injectBridge, pageHtml, posixPath, writeReactEntry, entryDir, UI_DIR } from './pages.ts';

export const frameworkAlias = { '@framework': UI_DIR };

export default function presentation(): Plugin {
  return {
    name: 'presentation-framework',
    config() {
      return {
        resolve: { alias: frameworkAlias },
        server: { watch: { ignored: ['**/dist/**'] } },
      };
    },
    configureServer(server: ViteDevServer) {
      const reload = () => server.ws.send({ type: 'full-reload', path: '*' });

      server.watcher.add(SECTIONS_DIR);
      const isSectionRoot = (file: string) => path.dirname(file) === SECTIONS_DIR;
      server.watcher.on('add', (f) => isSectionRoot(f) && reload());
      server.watcher.on('addDir', (f) => isSectionRoot(f) && reload());
      server.watcher.on('unlink', (f) => isSectionRoot(f) && reload());
      server.watcher.on('unlinkDir', (f) => isSectionRoot(f) && reload());
      // Dropped-in HTML pages are not part of Vite's module graph: reload when they change.
      server.watcher.on('change', (f) => f.startsWith(SECTIONS_DIR) && /\.html?$/i.test(f) && reload());
      server.watcher.add(CONFIG_FILE);
      server.watcher.on('change', (f) => f === CONFIG_FILE && reload());

      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        try {
          if (url === '/manifest.json') {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(publicManifest(buildManifest())));
            return;
          }
          const m = /^\/pages\/(ch[\d.]+)\.html$/.exec(url);
          if (!m) return next();

          const section = buildManifest().sections.find((s) => s.id === m[1]);
          if (!section) {
            res.statusCode = 404;
            res.end(`No section ${m[1]}`);
            return;
          }
          let html: string;
          if (section.kind === 'react') {
            writeReactEntry(section);
            const src = '/' + posixPath(path.relative(ROOT, path.join(entryDir(section), 'entry.tsx')));
            html = await server.transformIndexHtml(url, pageHtml(section, src));
          } else {
            html = fs.readFileSync(section.source, 'utf8');
          }
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(injectBridge(html));
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

// Compiles ./examples/*.java with the local JDK and writes ../bytecode.generated.json:
// real javap listings (code, line tables, exception tables, locals) + raw .class bytes.
// Run:  npm run gen:bytecode
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = import.meta.dirname;
const srcDir = path.join(here, 'examples');
const out = path.join(here, '..', 'bytecode.generated.json');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jvm-'));

const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.java')).sort();
execFileSync('javac', ['-g', '--release', '21', '-d', tmp, ...files.map((f) => path.join(srcDir, f))], { stdio: 'inherit' });
const javacVersion = execFileSync('javac', ['-version'], { encoding: 'utf8' }).trim();

function parseJavap(text) {
  const methods = [];
  let m = null;
  let mode = null;
  let pendingSwitch = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    let r;
    if ((r = /^  (\S.*);$/.exec(line))) {
      m = { decl: r[1], code: [], lines: [], exceptions: [], locals: [] };
      methods.push(m);
      mode = null;
      continue;
    }
    if (!m) continue;
    if (/^    Code:$/.test(line)) { mode = 'code'; continue; }
    if (/^      LineNumberTable:/.test(line)) { mode = 'lines'; continue; }
    if (/^      Exception table:/.test(line)) { mode = 'ex'; continue; }
    if (/^      LocalVariableTable:/.test(line)) { mode = 'locals'; continue; }
    if (/^      \S/.test(line)) { mode = null; continue; }
    if (mode === 'code') {
      if (pendingSwitch) {
        if (/^\s*}\s*$/.test(line)) { pendingSwitch = null; continue; }
        const c = /^\s*(-?\d+|default): (\d+)$/.exec(line);
        if (c) pendingSwitch.cases.push({ key: c[1], target: Number(c[2]) });
        continue;
      }
      if ((r = /^\s+(\d+): (\S+)\s*(.*)$/.exec(line))) {
        let [, off, op, rest] = r;
        let comment;
        const ci = rest.indexOf('//');
        if (ci >= 0) { comment = rest.slice(ci + 2).trim(); rest = rest.slice(0, ci).trim(); }
        const ins = { offset: Number(off), op, args: rest.replace(/\{\s*$/, '').trim().replace(/,\s+/g, ', ') };
        if (comment) ins.comment = comment;
        if (/\{\s*(\/\/.*)?$/.test(r[3])) { ins.cases = []; pendingSwitch = ins; ins.comment = undefined; }
        m.code.push(ins);
      }
    } else if (mode === 'lines' && (r = /line (\d+): (\d+)/.exec(line))) {
      m.lines.push({ line: Number(r[1]), start: Number(r[2]) });
    } else if (mode === 'ex' && (r = /^\s+(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/.exec(line))) {
      m.exceptions.push({ from: +r[1], to: +r[2], target: +r[3], type: r[4].replace(/^Class /, '') });
    } else if (mode === 'locals' && (r = /^\s+(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+)$/.exec(line))) {
      m.locals.push({ start: +r[1], length: +r[2], slot: +r[3], name: r[4], sig: r[5] });
    }
  }
  return methods;
}

const classes = {};
for (const f of files) {
  const name = f.replace(/\.java$/, '');
  const source = fs.readFileSync(path.join(srcDir, f), 'utf8');
  const javap = execFileSync('javap', ['-c', '-l', '-p', '-cp', tmp, name], { encoding: 'utf8' });
  const methods = parseJavap(javap).filter(
    // drop fields and the implicit default constructor (unless the source declares one)
    (m) => m.code.length > 0 && !(m.decl === `public ${name}()` && !new RegExp(`(?<!new )\\b${name}\\s*\\(`).test(source)),
  );
  const bytes = fs.readFileSync(path.join(tmp, `${name}.class`));
  classes[name] = { source, methods, classFile: bytes.toString('base64') };
}

fs.writeFileSync(out, JSON.stringify({ javac: javacVersion, release: 21, classes }, null, 1) + '\n');
console.log(`wrote ${path.relative(process.cwd(), out)} (${files.length} classes, ${javacVersion}, --release 21)`);

/** Typed access to bytecode.generated.json (real javac/javap output). */
import data from './bytecode.generated.json';

export interface Instruction {
  offset: number;
  op: string;
  args: string;
  comment?: string;
  cases?: { key: string; target: number }[];
}
export interface Method {
  decl: string;
  code: Instruction[];
  lines: { line: number; start: number }[];
  exceptions: { from: number; to: number; target: number; type: string }[];
  locals: { start: number; length: number; slot: number; name: string; sig: string }[];
}
export interface ClassData {
  source: string;
  methods: Method[];
  classFile: string;
}

export const JAVAC_VERSION: string = data.javac;
export const RELEASE: number = data.release;
export const CLASSES = data.classes as unknown as Record<string, ClassData>;

export function method(cls: string, name: string): Method {
  const m = CLASSES[cls].methods.find((m) => new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\(`).test(m.decl));
  if (!m) throw new Error(`no method ${cls}.${name}`);
  return m;
}

/** javap-style text of one instruction. */
export function formatIns(i: Instruction, opts: { comment?: boolean; pad?: number } = {}): string {
  const pad = opts.pad ?? 4;
  let s = `${String(i.offset).padStart(pad)}: ${i.op}`;
  if (i.args) s = s.padEnd(pad + 16) + i.args;
  if (i.cases) s += ' { ' + i.cases.map((c) => `${c.key}→${c.target}`).join(', ') + ' }';
  if (i.comment && opts.comment !== false) s = s.padEnd(pad + 30) + ' // ' + i.comment;
  return s;
}

export function formatMethod(m: Method, opts?: { comment?: boolean }) {
  return m.code.map((i) => formatIns(i, opts)).join('\n');
}

/** Source line for a bytecode offset, using the LineNumberTable. */
export function lineForOffset(m: Method, offset: number): number | undefined {
  let best: { line: number; start: number } | undefined;
  for (const e of m.lines) if (e.start <= offset && (!best || e.start >= best.start)) best = e;
  return best?.line;
}

/** Offsets whose LineNumberTable range maps to a given source line. */
export function offsetsForLine(m: Method, line: number): number[] {
  return m.code.filter((i) => lineForOffset(m, i.offset) === line).map((i) => i.offset);
}

/** Size in bytes of the method's code array. */
export function codeSize(m: Method): number {
  const last = m.code[m.code.length - 1];
  // every method here ends in a 1-byte return/athrow
  return last.offset + 1;
}

/** Locals table sorted by slot, with names (requires javac -g). */
export function localNames(m: Method): string[] {
  const names: string[] = [];
  for (const l of m.locals) names[l.slot] = names[l.slot] ? `${names[l.slot]}/${l.name}` : l.name;
  return names;
}

/** The source text of one method (from its signature line to its closing brace). */
export function methodSource(cls: string, name: string): { code: string; firstLine: number } {
  const lines = CLASSES[cls].source.split('\n');
  const start = lines.findIndex((l) => new RegExp(`\\b${name}\\s*\\(`).test(l) && /[{]\s*$/.test(l));
  if (start < 0) throw new Error(`no source for ${cls}.${name}`);
  const indent = /^\s*/.exec(lines[start])![0];
  let end = start + 1;
  while (end < lines.length && lines[end] !== `${indent}}`) end++;
  return { code: lines.slice(start, end + 1).map((l) => l.slice(indent.length)).join('\n'), firstLine: start + 1 };
}

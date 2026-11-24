/**
 * A deliberately tiny line-based highlighter — enough for slides, no dependency.
 * Languages: java / ts (C-like), py (Python), xml, jvm (javap-style bytecode), asm (register code), text.
 */
import { createElement, type ReactNode } from 'react';

export type Lang = 'java' | 'ts' | 'py' | 'xml' | 'jvm' | 'asm' | 'text';

const JAVA_KW = new Set(
  'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while var record yield true false null let function export from type interface'.split(
    ' ',
  ),
);

type Tok = [cls: string | null, text: string];

const span = (toks: Tok[]): ReactNode[] =>
  toks.map(([cls, text], i) => (cls ? createElement('span', { key: i, className: `tk-${cls}` }, text) : text));

function cLike(line: string): Tok[] {
  const out: Tok[] = [];
  const re = /(\/\/.*$|\/\*.*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d[\d_]*(?:\.\d+)?[lLfFdD]?\b)|(@\w+)|([A-Za-z_$][\w$]*)|(\s+|.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const [t, com, str, num, ann, word] = m;
    if (com) out.push(['com', t]);
    else if (str) out.push(['str', t]);
    else if (num) out.push(['num', t]);
    else if (ann) out.push(['ann', t]);
    else if (word) {
      if (JAVA_KW.has(word)) out.push(['kw', t]);
      else if (/^[A-Z]/.test(word)) out.push(['type', t]);
      else if (line[re.lastIndex] === '(') out.push(['fn', t]);
      else out.push([null, t]);
    } else out.push([null, t]);
  }
  return out;
}

const PY_KW = new Set(
  'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield self'.split(' '),
);

function py(line: string): Tok[] {
  const out: Tok[] = [];
  const re = /(#.*$)|([rbfRBF]{0,2}(?:"""|\'\'\'|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'))|(\b\d[\d_]*(?:\.\d+)?\b)|(@[\w.]+)|([A-Za-z_][\w]*)|(\s+|.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const [t, com, str, num, dec, word] = m;
    if (com) out.push(['com', t]);
    else if (str) out.push(['str', t]);
    else if (num) out.push(['num', t]);
    else if (dec) out.push(['ann', t]);
    else if (word) {
      if (PY_KW.has(word)) out.push(['kw', t]);
      else if (/^[A-Z]/.test(word)) out.push(['type', t]);
      else if (line[re.lastIndex] === '(') out.push(['fn', t]);
      else out.push([null, t]);
    } else out.push([null, t]);
  }
  return out;
}

function xml(line: string): Tok[] {
  const out: Tok[] = [];
  const re = /(<!--.*?(?:-->|$))|(<\/?[\w:.-]+|\/?>)|([\w:.-]+)(?==")|("[^"]*")|([^<"\w]+|\w+|.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const [t, com, tag, attr, str] = m;
    out.push([com ? 'com' : tag ? 'kw' : attr ? 'type' : str ? 'str' : null, t]);
  }
  return out;
}

/** Category of a JVM opcode mnemonic — also used for colouring elsewhere. */
export function opcodeCategory(op: string): string {
  if (/^(invoke)/.test(op)) return 'invoke';
  if (/return$/.test(op) || op === 'athrow') return 'ret';
  if (/^(if|goto|jsr|ret$|tableswitch|lookupswitch)/.test(op)) return 'branch';
  if (/^(new|newarray|anewarray|multianewarray|getfield|putfield|getstatic|putstatic|checkcast|instanceof|arraylength|monitor)/.test(op)) return 'obj';
  if (/^([ilfdab]const|bipush|sipush|ldc|aconst_null)/.test(op)) return 'const';
  if (/^([ilfdab]?a?(load|store))|^[ilfdabcs]a(load|store)$/.test(op)) return 'load';
  if (/^(pop|pop2|dup|dup_x1|dup_x2|dup2|dup2_x1|dup2_x2|swap|nop)$/.test(op)) return 'stack';
  if (/^[ilfd](add|sub|mul|div|rem|neg|shl|shr|ushr|and|or|xor|inc)$|^iinc$|^[lfd]cmp/.test(op)) return 'math';
  if (/^[ilfd]2[ilfdbcs]$/.test(op)) return 'conv';
  return 'op';
}

function jvm(line: string): Tok[] {
  const out: Tok[] = [];
  const m = /^(\s*)(\d+:)?(\s*)([a-z_0-9]+)?(.*?)(\s*\/\/.*)?$/.exec(line);
  if (!m || !m[4]) return [['com', line]];
  const [, ws1, off, ws2, op, rest, comment] = m;
  out.push([null, ws1]);
  if (off) out.push(['off', off]);
  out.push([null, ws2]);
  out.push([`op-${opcodeCategory(op)}`, op]);
  if (rest) {
    for (const p of rest.split(/(#\d+|-?\b\d+\b|,)/)) {
      if (!p) continue;
      out.push([/^#\d+$/.test(p) ? 'ref' : /^-?\d+$/.test(p) ? 'num' : null, p]);
    }
  }
  if (comment) out.push(['com', comment]);
  return out;
}

function asm(line: string): Tok[] {
  const out: Tok[] = [];
  const m = /^(\s*)(\d+:)?(\s*)([A-Za-z_.]+)?(.*?)(\s*(?:;|\/\/).*)?$/.exec(line);
  if (!m || !m[4]) return [['com', line]];
  const [, ws1, off, ws2, op, rest, comment] = m;
  out.push([null, ws1]);
  if (off) out.push(['off', off]);
  out.push([null, ws2]);
  out.push([/^(jmp|j[a-z]+|b[a-z]*|if.*|goto|call|ret|return)$/i.test(op) ? 'op-branch' : 'op-math', op]);
  for (const p of (rest ?? '').split(/(\b[rv]\d+\b|#?-?\b\d+\b)/)) {
    if (!p) continue;
    out.push([/^[rv]\d+$/.test(p) ? 'reg' : /^#?-?\d+$/.test(p) ? 'num' : null, p]);
  }
  if (comment) out.push(['com', comment]);
  return out;
}

export function highlight(line: string, lang: Lang): ReactNode {
  if (line === '') return '​';
  switch (lang) {
    case 'java':
    case 'ts':
      return span(cLike(line));
    case 'py':
      return span(py(line));
    case 'xml':
      return span(xml(line));
    case 'jvm':
      return span(jvm(line));
    case 'asm':
      return span(asm(line));
    default:
      return line;
  }
}

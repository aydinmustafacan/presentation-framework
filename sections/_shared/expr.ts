/**
 * A miniature compiler for int expressions such as "(a + b) * c - 2".
 * One AST, two back-ends: JVM-style stack code and Dalvik-style register code.
 */
export type Node =
  | { kind: 'num'; value: number; id: number }
  | { kind: 'var'; name: string; id: number }
  | { kind: 'neg'; arg: Node; id: number }
  | { kind: 'bin'; op: '+' | '-' | '*' | '/' | '%'; left: Node; right: Node; id: number };

export class ParseError extends Error {
  constructor(
    msg: string,
    public pos: number,
  ) {
    super(msg);
  }
}

export function parse(src: string): Node {
  let pos = 0;
  let id = 0;
  const peek = () => {
    while (src[pos] === ' ') pos++;
    return src[pos];
  };
  const expect = (c: string) => {
    if (peek() !== c) throw new ParseError(`expected "${c}"`, pos);
    pos++;
  };
  function expr(): Node {
    let n = term();
    while (peek() === '+' || peek() === '-') {
      const op = src[pos++] as '+' | '-';
      n = { kind: 'bin', op, left: n, right: term(), id: id++ };
    }
    return n;
  }
  function term(): Node {
    let n = unary();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = src[pos++] as '*' | '/' | '%';
      n = { kind: 'bin', op, left: n, right: unary(), id: id++ };
    }
    return n;
  }
  function unary(): Node {
    if (peek() === '-') {
      pos++;
      const arg = unary();
      if (arg.kind === 'num') return { ...arg, value: -arg.value };
      return { kind: 'neg', arg, id: id++ };
    }
    return atom();
  }
  function atom(): Node {
    const c = peek();
    if (c === '(') {
      pos++;
      const n = expr();
      expect(')');
      return n;
    }
    let m = /^\d+/.exec(src.slice(pos));
    if (m) {
      pos += m[0].length;
      const value = Number(m[0]);
      if (value > 32767) throw new ParseError('keep constants ≤ 32767', pos);
      return { kind: 'num', value, id: id++ };
    }
    m = /^[a-h]/.exec(src.slice(pos));
    if (m) {
      pos++;
      return { kind: 'var', name: m[0], id: id++ };
    }
    throw new ParseError(c === undefined ? 'unexpected end' : `unexpected "${c}" (variables: a–h)`, pos);
  }
  const n = expr();
  if (peek() !== undefined) throw new ParseError(`unexpected "${peek()}"`, pos);
  return n;
}

export function variables(n: Node, acc: string[] = []): string[] {
  if (n.kind === 'var' && !acc.includes(n.name)) acc.push(n.name);
  if (n.kind === 'neg') variables(n.arg, acc);
  if (n.kind === 'bin') {
    variables(n.left, acc);
    variables(n.right, acc);
  }
  return acc;
}

export function evaluate(n: Node, env: Record<string, number>): number {
  switch (n.kind) {
    case 'num':
      return n.value;
    case 'var':
      return env[n.name] ?? 0;
    case 'neg':
      return -evaluate(n.arg, env) | 0;
    case 'bin': {
      const a = evaluate(n.left, env);
      const b = evaluate(n.right, env);
      if ((n.op === '/' || n.op === '%') && b === 0) throw new Error('division by zero');
      return n.op === '+' ? (a + b) | 0 : n.op === '-' ? (a - b) | 0 : n.op === '*' ? Math.imul(a, b) : n.op === '/' ? Math.trunc(a / b) : a % b;
    }
  }
}

export interface Emitted {
  text: string;
  bytes: number;
  /** AST node that produced the instruction */
  node: number;
}

const OPNAME = { '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '%': 'rem' } as const;

/** JVM back-end: a post-order walk. Variables are parameters, so a=slot 0, b=slot 1… */
export function compileStack(root: Node, vars: string[]): { code: Emitted[]; maxStack: number } {
  const code: Emitted[] = [];
  let depth = 0;
  let maxStack = 0;
  const push = () => (maxStack = Math.max(maxStack, ++depth));
  function gen(n: Node) {
    switch (n.kind) {
      case 'num': {
        const v = n.value;
        if (v >= -1 && v <= 5) code.push({ text: `iconst_${v < 0 ? 'm1' : v}`, bytes: 1, node: n.id });
        else if (v >= -128 && v <= 127) code.push({ text: `bipush ${v}`, bytes: 2, node: n.id });
        else code.push({ text: `sipush ${v}`, bytes: 3, node: n.id });
        push();
        break;
      }
      case 'var': {
        const slot = vars.indexOf(n.name);
        code.push(slot <= 3 ? { text: `iload_${slot}`, bytes: 1, node: n.id } : { text: `iload ${slot}`, bytes: 2, node: n.id });
        push();
        break;
      }
      case 'neg':
        gen(n.arg);
        code.push({ text: 'ineg', bytes: 1, node: n.id });
        break;
      case 'bin':
        gen(n.left);
        gen(n.right);
        code.push({ text: `i${OPNAME[n.op]}`, bytes: 1, node: n.id });
        depth--;
        break;
    }
  }
  gen(root);
  code.push({ text: 'ireturn', bytes: 1, node: -1 });
  return { code, maxStack };
}

/**
 * Dalvik back-end: each subtree returns the register holding its value. Variables are already
 * in parameter registers, so they cost no instruction at all. Temps are recycled greedily.
 */
export function compileRegister(root: Node, vars: string[]): { code: Emitted[]; temps: number } {
  const code: Emitted[] = [];
  const free: number[] = [];
  let nextTemp = 0;
  const alloc = () => (free.length ? free.shift()! : nextTemp++);
  const isTemp = (r: string) => r.startsWith('v');
  const release = (r: string) => {
    if (isTemp(r)) {
      free.push(Number(r.slice(1)));
      free.sort((a, b) => a - b);
    }
  };

  function gen(n: Node): string {
    switch (n.kind) {
      case 'var':
        return `p${vars.indexOf(n.name)}`;
      case 'num': {
        const r = `v${alloc()}`;
        const small = n.value >= -8 && n.value <= 7;
        code.push({ text: `${small ? 'const/4' : 'const/16'} ${r}, ${n.value}`, bytes: small ? 2 : 4, node: n.id });
        return r;
      }
      case 'neg': {
        const a = gen(n.arg);
        release(a);
        const r = `v${alloc()}`;
        code.push({ text: `neg-int ${r}, ${a}`, bytes: 2, node: n.id });
        return r;
      }
      case 'bin': {
        const name = OPNAME[n.op];
        const l = gen(n.left);
        // literal forms: add/mul/div/rem take an 8-bit literal; a - k becomes a + (-k)
        const k = n.right.kind === 'num' ? (n.op === '-' ? -n.right.value : n.right.value) : null;
        if (k !== null && inLit8(k)) {
          release(l);
          const r = `v${alloc()}`;
          code.push({ text: `${n.op === '-' ? 'add' : name}-int/lit8 ${r}, ${l}, ${k}`, bytes: 4, node: n.id });
          return r;
        }
        const rr = gen(n.right);
        if (isTemp(l)) {
          release(rr);
          code.push({ text: `${name}-int/2addr ${l}, ${rr}`, bytes: 2, node: n.id });
          return l;
        }
        release(rr);
        const r = `v${alloc()}`;
        code.push({ text: `${name}-int ${r}, ${l}, ${rr}`, bytes: 4, node: n.id });
        return r;
      }
    }
  }
  const out = gen(root);
  code.push({ text: `return ${out}`, bytes: 2, node: -1 });
  return { code, temps: nextTemp };
}

const inLit8 = (v: number) => v >= -128 && v <= 127;

/** Simple tidy-tree layout for drawing the AST. */
export interface LaidOut {
  node: Node;
  x: number;
  y: number;
  label: string;
  children: LaidOut[];
}
export function layout(root: Node): { tree: LaidOut; width: number; depth: number } {
  let leaf = 0;
  let maxDepth = 0;
  function walk(n: Node, d: number): LaidOut {
    maxDepth = Math.max(maxDepth, d);
    const kids = n.kind === 'bin' ? [n.left, n.right] : n.kind === 'neg' ? [n.arg] : [];
    const children = kids.map((k) => walk(k, d + 1));
    const x = children.length ? children.reduce((s, c) => s + c.x, 0) / children.length : leaf++;
    const label = n.kind === 'num' ? String(n.value) : n.kind === 'var' ? n.name : n.kind === 'neg' ? '−' : n.op;
    return { node: n, x, y: d, label, children };
  }
  const tree = walk(root, 0);
  return { tree, width: Math.max(1, leaf), depth: maxDepth + 1 };
}

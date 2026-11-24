/**
 * A simplified model of one self-specializing Truffle node: the `a + b` inside a hot Python loop.
 * Real GraalPy nodes have more specializations and different names; the mechanics are the same:
 * start uninitialized, activate the cases you actually see, compile only those, and fall back to the
 * interpreter ("deoptimize") when a value shows up that the compiled code did not plan for.
 */

export type PyType = 'int' | 'float' | 'str' | 'list';
export interface PyVal { type: PyType; text: string; raw: string; int?: bigint; num?: number }

export type SpecId = 'int' | 'bigint' | 'float' | 'mixed' | 'str' | 'generic';
export const SPECS: Record<SpecId, { label: string; guard: string; body: string; why: string }> = {
  int: { label: 'int + int (fits 64 bits)', guard: 'a is int && b is int', body: 'r = a + b  // one machine add, jump to deopt on overflow', why: 'Python ints are unbounded, but almost all of them fit in a machine word. The fast path assumes they do and checks the CPU overflow flag.' },
  bigint: { label: 'int + int (big)', guard: 'a is int && b is int', body: 'r = BigInteger.add(a, b)', why: 'Used once a sum overflowed 64 bits. It is correct for any size, but it is a library call rather than a single instruction.' },
  float: { label: 'float + float', guard: 'a is float && b is float', body: 'r = a + b  // one FP add', why: 'Floats are 64-bit doubles, so this is a single floating-point instruction.' },
  mixed: { label: 'int + float (mixed)', guard: '(a, b) are int/float', body: 'r = toDouble(a) + toDouble(b)', why: 'Python promotes the int to a float before adding.' },
  str: { label: 'str + str', guard: 'a is str && b is str', body: 'r = concat(a, b)', why: 'String concatenation: a different operation that happens to use the same `+`.' },
  generic: { label: 'generic: a.__add__(b)', guard: '(anything)', body: 'r = lookup __add__ / __radd__ and call it', why: 'The full Python protocol: look up the method on the type and call it. Always correct, slowest, and when it is activated it replaces the specific cases ("megamorphic").' },
};

export interface Snapshot {
  call: number;
  a?: PyVal; b?: PyVal; result?: string;
  handledBy?: SpecId;
  activated?: SpecId;
  active: SpecId[];
  hits: Partial<Record<SpecId, number>>;
  sinceCompile: number;
  compiled: SpecId[] | null;
  event: 'start' | 'interp' | 'compile' | 'fast' | 'deopt';
  deopts: number;
  compiles: number;
  note: string;
}

export const THRESHOLD = 4; // illustrative; real Truffle thresholds are in the hundreds/thousands of calls+loop iterations

const MAX64 = (1n << 63n) - 1n, MIN64 = -(1n << 63n);

export function val(text: string): PyVal {
  const t = text.trim();
  if (/^-?\d+$/.test(t)) return { type: 'int', text: t, raw: t, int: BigInt(t) };
  if (/^-?\d*\.\d+$/.test(t)) return { type: 'float', text: t, raw: t, num: parseFloat(t) };
  if (/^\[.*\]$/.test(t)) return { type: 'list', text: t, raw: t };
  const raw = t.replace(/^["']|["']$/g, '');
  return { type: 'str', text: `'${raw}'`, raw };
}

function classify(a: PyVal, b: PyVal): { spec: SpecId; result: string } {
  if (a.type === 'int' && b.type === 'int') {
    const r = a.int! + b.int!;
    const fits = a.int! <= MAX64 && a.int! >= MIN64 && b.int! <= MAX64 && b.int! >= MIN64 && r <= MAX64 && r >= MIN64;
    return { spec: fits ? 'int' : 'bigint', result: r.toString() };
  }
  const num = (v: PyVal) => (v.type === 'int' ? Number(v.int) : v.num!);
  if (a.type === 'float' && b.type === 'float') return { spec: 'float', result: fmtFloat(num(a) + num(b)) };
  if ((a.type === 'int' || a.type === 'float') && (b.type === 'int' || b.type === 'float')) return { spec: 'mixed', result: fmtFloat(num(a) + num(b)) };
  if (a.type === 'str' && b.type === 'str') return { spec: 'str', result: `'${a.raw}${b.raw}'` };
  if (a.type === 'list' && b.type === 'list') return { spec: 'generic', result: `[${[a.text.slice(1, -1), b.text.slice(1, -1)].filter(Boolean).join(', ')}]` };
  return { spec: 'generic', result: 'TypeError' };
}
const fmtFloat = (x: number) => (Number.isInteger(x) ? x.toFixed(1) : String(x));

/** Does compiled code built for `compiled` cover this case? The bigint case also covers small ints (it is just slower). */
function covers(compiled: SpecId[], spec: SpecId) {
  if (compiled.includes('generic')) return true;
  if (spec === 'int' && compiled.includes('bigint')) return true;
  return compiled.includes(spec);
}

export function run(pairs: [string, string][]): Snapshot[] {
  let s: Snapshot = { call: 0, active: [], hits: {}, sinceCompile: 0, compiled: null, event: 'start', deopts: 0, compiles: 0, note: 'The node starts uninitialized: no specializations, no compiled code. The first execution decides what it becomes.' };
  const out: Snapshot[] = [s];
  for (const [x, y] of pairs) {
    const a = val(x), b = val(y);
    const { spec, result } = classify(a, b);
    const next: Snapshot = { ...s, call: s.call + 1, a, b, result, handledBy: spec, activated: undefined, hits: { ...s.hits }, active: [...s.active] };
    const describe = `${a.text} + ${b.text} = ${result}`;

    if (s.compiled && covers(s.compiled, spec)) {
      next.event = 'fast';
      next.handledBy = s.compiled.includes(spec) ? spec : s.compiled.includes('generic') ? 'generic' : 'bigint';
      next.hits[next.handledBy] = (next.hits[next.handledBy] ?? 0) + 1;
      next.note = next.handledBy === 'generic'
        ? `${describe}. Compiled, but the only case left is the generic one: even this ${a.type} + ${b.type} looks up __add__ at run time. Megamorphic code is compiled code that is still slow.`
        : `${describe}. Runs in compiled machine code: the guard for ${SPECS[next.handledBy].label} passes, so no interpreter and no type dispatch.`;
    } else {
      const deopt = Boolean(s.compiled);
      let activated: SpecId | undefined;
      if (spec === 'generic' || (next.active.length >= 4 && !next.active.includes(spec))) {
        if (!next.active.includes('generic')) activated = 'generic';
        next.active = ['generic'];
      } else if (spec === 'bigint' && next.active.includes('int')) {
        activated = 'bigint';
        next.active = next.active.map((x) => (x === 'int' ? 'bigint' : x));
      } else if (!next.active.includes(spec) && !(spec === 'int' && next.active.includes('bigint')) && !next.active.includes('generic')) {
        activated = spec;
        next.active.push(spec);
      }
      const handled: SpecId = next.active.includes('generic') ? 'generic' : spec === 'int' && next.active.includes('bigint') ? 'bigint' : spec;
      next.handledBy = handled;
      next.activated = activated;
      next.hits[handled] = (next.hits[handled] ?? 0) + 1;
      if (deopt) {
        next.event = 'deopt';
        next.deopts++;
        next.compiled = null;
        next.sinceCompile = 0;
        next.note = `${describe}. The compiled code has no case for ${SPECS[spec].label}: it jumps back into the interpreter (deoptimization), throws the machine code away, ${activated ? `activates “${SPECS[activated].label}”` : 'rewrites the node'} and starts counting again.`;
      } else {
        next.event = 'interp';
        next.sinceCompile = s.sinceCompile + 1;
        next.note = activated
          ? `${describe}. First time this node sees ${a.type} + ${b.type}: it ${activated === 'generic' && s.active.length ? 'gives up on specific cases and replaces them with' : 'activates'} “${SPECS[activated].label}”. Still in the interpreter.`
          : `${describe}. Interpreted, through the already-active “${SPECS[handled].label}” case. Call ${next.sinceCompile} of ${THRESHOLD} before compilation.`;
      }
      if (!deopt && next.sinceCompile >= THRESHOLD) {
        next.event = 'compile';
        next.compiled = [...next.active];
        next.compiles++;
        next.note += ` That makes it hot: Graal partially evaluates the interpreter for this node and emits machine code for exactly the active cases (${next.compiled.map((c) => SPECS[c].label).join(', ')}). Anything else becomes a deopt exit.`;
      }
    }
    out.push(next);
    s = next;
  }
  return out;
}

/** Pseudo machine code for the compiled version. */
export function compiledCode(compiled: SpecId[]): string {
  const lines = ['// compiled  a + b'];
  compiled.forEach((c, i) => {
    lines.push(`${i ? '} else if' : 'if'} (${SPECS[c].guard}) {`, `    ${SPECS[c].body}`);
  });
  if (!compiled.includes('generic')) lines.push('} else {', '    deoptimize()  // back to the interpreter');
  lines.push('}');
  return lines.join('\n');
}

const I = (n: number) => [String(n), String(n * 3 + 1)] as [string, string];
export const PRESETS: { id: string; label: string; pairs: [string, string][] }[] = [
  { id: 'ints', label: 'Only small ints', pairs: [1, 2, 3, 4, 5, 6, 7, 8].map(I) },
  { id: 'overflow', label: 'An int overflows', pairs: [...[1, 2, 3, 4, 5].map(I), ['9223372036854775807', '1'], ...[6, 7, 8, 9, 10].map(I)] },
  { id: 'floats', label: 'Then a float', pairs: [...[1, 2, 3, 4, 5].map(I), ['1.5', '2.25'], ['2', '0.5'], ['3.0', '4.0'], ...[6, 7, 8, 9].map(I)] },
  { id: 'mega', label: 'Strings and lists', pairs: [...[1, 2, 3, 4].map(I), ["'Hel'", "'lo'"], ['1.5', '2.5'], ['[1]', '[2]'], ...[5, 6, 7, 8, 9].map(I), ["'a'", "'b'"]] },
];

/**
 * A register machine in the style of Android's Dalvik/ART (smali syntax). The programs are
 * hand-translated from Sim.java the way d8 would lower them: parameters live in p0..pN,
 * temporaries in v0..vN, and every instruction names its operands explicitly.
 *
 * Sizes are Dalvik code units (16 bits each), taken from the Dalvik instruction formats.
 */
export interface RegIns {
  label?: string;
  text: string;
  op: string;
  /** operands: register names, numbers, or a :label */
  args: string[];
  /** size in 16-bit code units */
  units: number;
  comment?: string;
}

export interface RegProgram {
  name: string;
  params: string[];
  temps: string[];
  code: RegIns[];
  /** line in Sim.java each instruction comes from */
  javaLines: number[];
}

/** Code units per Dalvik instruction format. */
const UNITS: Record<string, number> = {
  'const/4': 1,
  move: 1,
  'add-int/2addr': 1,
  'mul-int/2addr': 1,
  'sub-int/2addr': 1,
  goto: 1,
  return: 1,
  'move-result': 1,
  'add-int': 2,
  'sub-int': 2,
  'mul-int': 2,
  'rem-int': 2,
  'div-int': 2,
  'add-int/lit8': 2,
  'mul-int/lit8': 2,
  'if-gt': 2,
  'if-le': 2,
  'if-lt': 2,
  'if-ge': 2,
  'if-eq': 2,
  'if-ne': 2,
  'if-eqz': 2,
  'if-nez': 2,
  'const/16': 2,
  'invoke-static': 3,
};

function asm(src: string): { code: RegIns[]; javaLines: number[] } {
  const code: RegIns[] = [];
  const javaLines: number[] = [];
  let label: string | undefined;
  for (const raw of src.trim().split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith(':')) {
      label = line;
      continue;
    }
    const [body, meta] = line.split('@');
    const [text, comment] = body.split('#').map((s) => s.trim());
    const sp = text.indexOf(' ');
    const op = sp < 0 ? text : text.slice(0, sp);
    const args =
      sp < 0
        ? []
        : text
            .slice(sp + 1)
            .replace(/[{}]/g, '')
            .split(',')
            .map((s) => s.trim());
    if (!(op in UNITS)) throw new Error(`regvm: unknown op ${op}`);
    code.push({ label, text, op, args, units: UNITS[op], comment });
    javaLines.push(Number(meta));
    label = undefined;
  }
  return { code, javaLines };
}

export const REG_PROGRAMS: Record<string, RegProgram> = {
  arith: {
    name: 'arith',
    params: ['p0', 'p1', 'p2'],
    temps: ['v0'],
    ...asm(`
      add-int v0, p0, p1     # v0 = a + b          @3
      mul-int/2addr v0, p2   # v0 = v0 * c         @3
      return v0                                    @3
    `),
  },
  max: {
    name: 'max',
    params: ['p0', 'p1'],
    temps: [],
    ...asm(`
      if-le p0, p1, :else    # a <= b ? jump       @29
      return p0                                    @29
      :else
      return p1                                    @29
    `),
  },
  sum: {
    name: 'sum',
    params: ['p0'],
    temps: ['v0', 'v1'],
    ...asm(`
      const/4 v0, 0          # s = 0               @7
      const/4 v1, 1          # i = 1               @8
      :loop
      if-gt v1, p0, :end     # i > n ? exit        @8
      add-int/2addr v0, v1   # s += i              @9
      add-int/lit8 v1, v1, 1 # i++                 @8
      goto :loop                                   @8
      :end
      return v0                                    @11
    `),
  },
  gcd: {
    name: 'gcd',
    params: ['p0', 'p1'],
    temps: ['v0'],
    ...asm(`
      :loop
      if-eqz p1, :end        # b == 0 ? exit       @15
      move v0, p1            # t = b               @16
      rem-int p1, p0, p1     # b = a % b           @17
      move p0, v0            # a = t               @18
      goto :loop                                   @19
      :end
      return p0                                    @20
    `),
  },
  fact: {
    name: 'fact',
    params: ['p0'],
    temps: ['v0'],
    ...asm(`
      const/4 v0, 1                                @24
      if-gt p0, v0, :rec     # n > 1 ? recurse     @24
      return v0                                    @24
      :rec
      add-int/lit8 v0, p0, -1  # v0 = n - 1        @25
      invoke-static {v0}, fact                     @25
      move-result v0                               @25
      mul-int/2addr v0, p0     # v0 = result * n   @25
      return v0                                    @25
    `),
  },
};

export interface RegFrame {
  method: string;
  pc: number;
  regs: Record<string, number | null>;
  /** value waiting for move-result */
  result: number | null;
}

export interface RegSnapshot {
  frames: RegFrame[];
  executed?: { method: string; index: number; depth: number };
  note: string;
  wrote: string[];
  read: string[];
  done: boolean;
  result?: number;
  stats: { instructions: number; regReads: number; regWrites: number; units: number };
}

const CMP: Record<string, (a: number, b: number) => boolean> = {
  eq: (a, b) => a === b,
  ne: (a, b) => a !== b,
  lt: (a, b) => a < b,
  ge: (a, b) => a >= b,
  gt: (a, b) => a > b,
  le: (a, b) => a <= b,
};
const SYM: Record<string, string> = { eq: '==', ne: '!=', lt: '<', ge: '>=', gt: '>', le: '<=' };

function frameFor(name: string, args: number[]): RegFrame {
  const p = REG_PROGRAMS[name];
  const regs: Record<string, number | null> = {};
  for (const t of p.temps) regs[t] = null;
  p.params.forEach((r, i) => (regs[r] = args[i] ?? 0));
  return { method: name, pc: 0, regs, result: null };
}

const clone = (fs: RegFrame[]) => fs.map((f) => ({ ...f, regs: { ...f.regs } }));

export function runReg(program: string, args: number[], limit = 600): RegSnapshot[] {
  const stats = { instructions: 0, regReads: 0, regWrites: 0, units: 0 };
  let frames = [frameFor(program, args)];
  const out: RegSnapshot[] = [
    {
      frames: clone(frames),
      note: `A frame with a fixed register file is created. Arguments land directly in p0…p${args.length - 1}; nothing is copied around.`,
      wrote: [],
      read: [],
      done: false,
      stats: { ...stats },
    },
  ];

  while (out.length < limit) {
    const f = frames[frames.length - 1];
    const prog = REG_PROGRAMS[f.method];
    const index = f.pc;
    const ins = prog.code[index];
    const depth = frames.length - 1;
    const read: string[] = [];
    const wrote: string[] = [];
    const get = (r: string) => {
      read.push(r);
      stats.regReads++;
      return f.regs[r] ?? 0;
    };
    const set = (r: string, v: number) => {
      wrote.push(r);
      stats.regWrites++;
      f.regs[r] = v | 0;
    };
    const jump = (label: string) => {
      f.pc = prog.code.findIndex((x) => x.label === label);
    };
    f.pc++;
    stats.instructions++;
    stats.units += ins.units;
    let note = '';
    let done = false;
    let result: number | undefined;
    const [A, B, C] = ins.args;
    let r: RegExpExecArray | null;

    if (ins.op === 'const/4' || ins.op === 'const/16') {
      set(A, Number(B));
      note = `Write the constant ${B} straight into ${A}.`;
    } else if (ins.op === 'move') {
      set(A, get(B));
      note = `Copy ${B} (${f.regs[B]}) into ${A}.`;
    } else if ((r = /^(add|sub|mul|rem|div)-int(\/2addr|\/lit8)?$/.exec(ins.op))) {
      const kind = r[2];
      const x = kind === '/2addr' ? get(A) : get(B);
      const y = kind === '/2addr' ? get(B) : kind === '/lit8' ? Number(C) : get(C);
      const v = r[1] === 'add' ? x + y : r[1] === 'sub' ? x - y : r[1] === 'mul' ? Math.imul(x, y) : r[1] === 'div' ? Math.trunc(x / y) : x % y;
      const sym = { add: '+', sub: '-', mul: '*', rem: '%', div: '/' }[r[1]]!;
      set(A, v);
      note =
        kind === '/2addr'
          ? `${A} = ${A} ${sym} ${B} → ${x} ${sym} ${y} = ${v | 0}. The /2addr form reuses the destination as a source to fit in one code unit.`
          : kind === '/lit8'
            ? `${A} = ${B} ${sym} ${C} → ${v | 0}. The literal is encoded in the instruction.`
            : `${A} = ${B} ${sym} ${C} → ${x} ${sym} ${y} = ${v | 0}. One instruction names both sources and the destination.`;
    } else if ((r = /^if-(\w\w)(z?)$/.exec(ins.op))) {
      const zero = r[2] === 'z';
      const x = get(A);
      const y = zero ? 0 : get(B);
      const taken = CMP[r[1]](x, y);
      if (taken) jump(zero ? B : C);
      note = `Compare ${A}${zero ? '' : ` and ${B}`}: ${x} ${SYM[r[1]]} ${y} is ${taken} → ${taken ? `jump to ${zero ? B : C}` : 'fall through'}.`;
    } else if (ins.op === 'goto') {
      jump(A);
      note = `Jump to ${A}.`;
    } else if (ins.op === 'invoke-static') {
      const callArgs = ins.args.slice(0, -1).map(get);
      frames.push(frameFor(B, callArgs));
      note = `Call ${B}(${callArgs.join(', ')}): a new frame whose p0 receives ${A}'s value.`;
    } else if (ins.op === 'move-result') {
      set(A, f.result ?? 0);
      note = `Fetch the callee's return value into ${A}.`;
    } else if (ins.op === 'return') {
      const v = get(A);
      frames.pop();
      if (frames.length === 0) {
        frames = [f];
        done = true;
        result = v;
        note = `Return ${A} = ${v}. Done.`;
      } else {
        frames[frames.length - 1].result = v;
        note = `Return ${v}; the caller will pick it up with move-result.`;
      }
    } else {
      throw new Error(`regvm: unsupported ${ins.op}`);
    }

    out.push({ frames: clone(frames), executed: { method: f.method, index, depth }, note, wrote, read, done, result, stats: { ...stats } });
    if (done) break;
  }
  return out;
}

export function staticSize(p: RegProgram) {
  return p.code.reduce((n, i) => n + i.units * 2, 0);
}

export function formatReg(p: RegProgram) {
  const lines: string[] = [];
  for (const i of p.code) {
    if (i.label) lines.push(`${i.label}`);
    lines.push(`    ${i.text.padEnd(26)}${i.comment ? `; ${i.comment}` : ''}`);
  }
  return lines.join('\n');
}

/** Map an instruction index to its line in formatReg() output (1-based). */
export function regLineOf(p: RegProgram, index: number) {
  let line = 0;
  for (let k = 0; k <= index; k++) line += p.code[k].label ? 2 : 1;
  return line;
}

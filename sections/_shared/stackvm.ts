/**
 * A tiny JVM interpreter for int-only static methods. It executes the *real* javap
 * output in bytecode.generated.json and records a snapshot after every instruction.
 */
import { CLASSES, localNames, type Instruction, type Method } from './bytecode.ts';

export interface Frame {
  method: string;
  /** index into method.code of the NEXT instruction */
  pc: number;
  locals: (number | null)[];
  localNames: string[];
  stack: number[];
  maxStack: number;
}

export interface Snapshot {
  frames: Frame[];
  /** instruction that produced this snapshot (in the frame where it executed) */
  executed?: { method: string; index: number; depth: number };
  note: string;
  /** stack values pushed by the executed instruction (top-most frame after execution) */
  pushed: number;
  popped: number;
  done: boolean;
  result?: number;
  stats: { instructions: number; pushes: number; pops: number; localReads: number; localWrites: number };
}

export const PROGRAMS = {
  arith: { label: '(a + b) * c', params: ['a', 'b', 'c'], defaults: [3, 4, 5] },
  max: { label: 'max(a, b)', params: ['a', 'b'], defaults: [7, 12] },
  sum: { label: 'sum 1..n', params: ['n'], defaults: [4] },
  gcd: { label: 'gcd(a, b)', params: ['a', 'b'], defaults: [48, 18] },
  fact: { label: 'fact(n) — recursive', params: ['n'], defaults: [4] },
} as const;
export type ProgramName = keyof typeof PROGRAMS;

export function simMethod(name: string): Method {
  const m = CLASSES.Sim.methods.find((m) => m.decl.includes(` ${name}(`));
  if (!m) throw new Error(`Sim.${name} not found`);
  return m;
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

/** Max operand-stack depth reached, statically — what javac writes as max_stack. */
function maxStackOf(m: Method): number {
  // good enough for these straight-line int methods: replay along fall-through order
  let depth = 0;
  let max = 0;
  for (const i of m.code) {
    const [pop, push] = effect(i);
    depth = Math.max(0, depth - pop) + push;
    max = Math.max(max, depth);
    if (/return|goto/.test(i.op)) depth = 0;
  }
  return Math.max(max, 1);
}

function effect(i: Instruction): [number, number] {
  const op = i.op;
  if (/^(iconst|bipush|sipush|iload)/.test(op)) return [0, 1];
  if (/^istore/.test(op)) return [1, 0];
  if (/^i(add|sub|mul|div|rem)$/.test(op)) return [2, 1];
  if (op === 'ineg') return [1, 1];
  if (/^if_icmp/.test(op)) return [2, 0];
  if (/^if/.test(op)) return [1, 0];
  if (op === 'ireturn') return [1, 0];
  if (op === 'invokestatic') return [argCount(i), 1];
  if (op === 'dup') return [1, 2];
  if (op === 'pop') return [1, 0];
  return [0, 0];
}

function argCount(i: Instruction): number {
  const desc = /:\((.*?)\)/.exec(i.comment ?? '')?.[1] ?? '';
  return desc.length; // only I parameters here
}

function newFrame(name: string, args: number[]): Frame {
  const m = simMethod(name);
  const names = localNames(m);
  const n = Math.max(names.length, args.length);
  const locals: (number | null)[] = Array.from({ length: n }, (_, k) => (k < args.length ? args[k] : null));
  return { method: name, pc: 0, locals, localNames: names, stack: [], maxStack: maxStackOf(m) };
}

const clone = (fs: Frame[]): Frame[] => fs.map((f) => ({ ...f, locals: [...f.locals], stack: [...f.stack] }));

export function run(program: string, args: number[], limit = 600): Snapshot[] {
  const stats = { instructions: 0, pushes: 0, pops: 0, localReads: 0, localWrites: 0 };
  let frames: Frame[] = [newFrame(program, args)];
  const out: Snapshot[] = [
    {
      frames: clone(frames),
      note: `A new frame is pushed for ${program}(${args.join(', ')}). Arguments are copied into local variables ${args
        .map((_, i) => i)
        .join(', ')}; the operand stack starts empty.`,
      pushed: 0,
      popped: 0,
      done: false,
      stats: { ...stats },
    },
  ];

  while (out.length < limit) {
    const f = frames[frames.length - 1];
    const m = simMethod(f.method);
    const index = f.pc;
    const ins = m.code[index];
    const depth = frames.length - 1;
    let note = '';
    let pushed = 0;
    let popped = 0;
    let done = false;
    let result: number | undefined;
    const push = (v: number) => {
      f.stack.push(v | 0);
      pushed++;
      stats.pushes++;
    };
    const pop = () => {
      popped++;
      stats.pops++;
      return f.stack.pop()!;
    };
    const jump = (target: number) => {
      f.pc = m.code.findIndex((x) => x.offset === target);
    };
    f.pc++;
    stats.instructions++;
    const op = ins.op;
    let r: RegExpExecArray | null;

    if ((r = /^iconst_(m1|\d)$/.exec(op))) {
      const v = r[1] === 'm1' ? -1 : Number(r[1]);
      push(v);
      note = `Push the constant ${v}. iconst_${r[1]} is a single byte — the value is baked into the opcode.`;
    } else if (op === 'bipush' || op === 'sipush') {
      push(Number(ins.args));
      note = `Push ${ins.args}, encoded inline in the instruction.`;
    } else if ((r = /^iload(?:_(\d))?$/.exec(op))) {
      const n = Number(r[1] ?? ins.args);
      push(f.locals[n] ?? 0);
      stats.localReads++;
      note = `Copy local ${n} (${f.localNames[n] ?? '?'} = ${f.locals[n]}) onto the operand stack.`;
    } else if ((r = /^istore(?:_(\d))?$/.exec(op))) {
      const n = Number(r[1] ?? ins.args);
      const v = pop();
      f.locals[n] = v;
      stats.localWrites++;
      note = `Pop ${v} off the stack into local ${n} (${f.localNames[n] ?? '?'}).`;
    } else if ((r = /^i(add|sub|mul|div|rem)$/.exec(op))) {
      const b = pop();
      const a = pop();
      const sym = { add: '+', sub: '-', mul: '*', div: '/', rem: '%' }[r[1]]!;
      const v = r[1] === 'add' ? a + b : r[1] === 'sub' ? a - b : r[1] === 'mul' ? Math.imul(a, b) : r[1] === 'div' ? Math.trunc(a / b) : a % b;
      push(v);
      note = `Pop two ints (${a} and ${b}), push ${a} ${sym} ${b} = ${v | 0}. No operands in the instruction: both inputs are implicit — the top of the stack.`;
    } else if (op === 'iinc') {
      const [n, c] = ins.args.split(',').map((s) => Number(s.trim()));
      f.locals[n] = ((f.locals[n] ?? 0) + c) | 0;
      stats.localReads++;
      stats.localWrites++;
      note = `Add ${c} to local ${n} (${f.localNames[n]}) in place → ${f.locals[n]}. One of the few instructions that bypass the stack.`;
    } else if ((r = /^if_icmp(\w\w)$/.exec(op))) {
      const b = pop();
      const a = pop();
      const taken = CMP[r[1]](a, b);
      if (taken) jump(Number(ins.args));
      note = `Pop ${a} and ${b}. ${a} ${SYM[r[1]]} ${b} is ${taken}, so ${taken ? `jump to offset ${ins.args}` : 'fall through to the next instruction'}.`;
    } else if ((r = /^if(\w\w)$/.exec(op))) {
      const a = pop();
      const taken = CMP[r[1]](a, 0);
      if (taken) jump(Number(ins.args));
      note = `Pop ${a}. ${a} ${SYM[r[1]]} 0 is ${taken}, so ${taken ? `jump to offset ${ins.args}` : 'fall through'}.`;
    } else if (op === 'goto') {
      jump(Number(ins.args));
      note = `Jump back to offset ${ins.args}.`;
    } else if (op === 'invokestatic') {
      const callee = /Method (\w+):/.exec(ins.comment ?? '')![1];
      const n = argCount(ins);
      const a: number[] = [];
      for (let k = 0; k < n; k++) a.unshift(pop());
      frames.push(newFrame(callee, a));
      note = `Pop ${n} argument${n === 1 ? '' : 's'} (${a.join(', ')}) and push a NEW frame for ${callee}. The caller's frame waits, its pc parked after the call.`;
    } else if (op === 'ireturn') {
      const v = pop();
      frames.pop();
      if (frames.length === 0) {
        frames = [{ ...f, stack: [] }];
        done = true;
        result = v;
        note = `Return ${v}. The last frame is popped — the method is finished.`;
      } else {
        const caller = frames[frames.length - 1];
        caller.stack.push(v);
        stats.pushes++;
        pushed = 1;
        note = `Return ${v}: this frame is discarded and ${v} is pushed onto the caller's (${caller.method}) operand stack.`;
      }
    } else if (op === 'dup') {
      const v = pop();
      push(v);
      push(v);
      note = `Duplicate the top value (${v}).`;
    } else if (op === 'pop') {
      pop();
      note = 'Discard the top value.';
    } else {
      throw new Error(`stackvm: unsupported ${op}`);
    }

    out.push({
      frames: clone(frames),
      executed: { method: simMethodName(m), index, depth },
      note,
      pushed,
      popped,
      done,
      result,
      stats: { ...stats },
    });
    if (done) break;
  }
  return out;
}

function simMethodName(m: Method) {
  return /(\w+)\(/.exec(m.decl)![1];
}

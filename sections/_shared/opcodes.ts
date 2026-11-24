/**
 * The complete JVM instruction set (JVMS §6.5), built from families to keep it compact.
 *
 * Operand encodings (used by the class-file disassembler):
 *   b  s1 signed byte          B  u1 unsigned byte (local index, count, atype)
 *   s  s2 signed short         S  u2 constant-pool index
 *   o  s2 branch offset        O  s4 branch offset
 *   0  a zero byte             *  variable length (tableswitch, lookupswitch, wide)
 */
export type Category =
  | 'constants'
  | 'loads'
  | 'stores'
  | 'stack'
  | 'math'
  | 'conversions'
  | 'comparisons'
  | 'control'
  | 'references'
  | 'extended'
  | 'reserved';

export interface Opcode {
  code: number;
  name: string;
  operands: string;
  category: Category;
  stack: string;
  desc: string;
}

export const CATEGORY_INFO: Record<Category, { label: string; color: string; blurb: string }> = {
  constants: { label: 'Constants', color: '#a5d6a7', blurb: 'Push a constant onto the operand stack.' },
  loads: { label: 'Loads', color: '#79c0ff', blurb: 'Copy a local variable or array element onto the stack.' },
  stores: { label: 'Stores', color: '#5cb8ff', blurb: 'Pop the stack into a local variable or array element.' },
  stack: { label: 'Stack', color: '#f0e68c', blurb: 'Shuffle the operand stack without looking at values.' },
  math: { label: 'Math', color: '#d2a8ff', blurb: 'Arithmetic and bitwise operations, typed by prefix.' },
  conversions: { label: 'Conversions', color: '#c9d1d9', blurb: 'Widening and narrowing primitive conversions.' },
  comparisons: { label: 'Comparisons', color: '#ffa198', blurb: 'Compare and branch.' },
  control: { label: 'Control', color: '#ff8f8f', blurb: 'Unconditional jumps, switches and returns.' },
  references: { label: 'References', color: '#4fd1c5', blurb: 'Objects, fields, arrays, method invocation, exceptions, monitors.' },
  extended: { label: 'Extended', color: '#ffb066', blurb: 'Wide indices, null checks, far jumps, multi-dim arrays.' },
  reserved: { label: 'Reserved', color: '#6b7385', blurb: 'Never appear in class files; for debuggers and JVM internals.' },
};

const T: Record<string, string> = { i: 'int', l: 'long', f: 'float', d: 'double', a: 'reference', b: 'byte/boolean', c: 'char', s: 'short' };

const ops: Opcode[] = [];
let next = 0;
function add(name: string, operands: string, category: Category, stack: string, desc: string, code = next) {
  ops.push({ code, name, operands, category, stack, desc });
  next = code + 1;
}

// ---- constants 0x00–0x14
add('nop', '', 'constants', '— → —', 'Do nothing.');
add('aconst_null', '', 'constants', '→ null', 'Push the null reference.');
for (let v = -1; v <= 5; v++) add(`iconst_${v < 0 ? 'm1' : v}`, '', 'constants', `→ ${v}`, `Push int constant ${v}. One byte instead of three for bipush.`);
for (const v of [0, 1]) add(`lconst_${v}`, '', 'constants', `→ ${v}L`, `Push long constant ${v} (takes two stack slots).`);
for (const v of [0, 1, 2]) add(`fconst_${v}`, '', 'constants', `→ ${v}.0f`, `Push float constant ${v}.0.`);
for (const v of [0, 1]) add(`dconst_${v}`, '', 'constants', `→ ${v}.0`, `Push double constant ${v}.0 (two slots).`);
add('bipush', 'b', 'constants', '→ value', 'Push a sign-extended byte (-128…127) as an int.');
add('sipush', 's', 'constants', '→ value', 'Push a sign-extended short (-32768…32767) as an int.');
add('ldc', 'B', 'constants', '→ value', 'Push an int, float, String, Class, MethodType or MethodHandle from the constant pool (index ≤ 255).');
add('ldc_w', 'S', 'constants', '→ value', 'Like ldc, with a 16-bit constant-pool index.');
add('ldc2_w', 'S', 'constants', '→ value', 'Push a long or double from the constant pool.');

// ---- loads 0x15–0x35
for (const t of 'ilfda') add(`${t}load`, 'B', 'loads', `→ value`, `Push the ${T[t]} in local variable #index.`);
for (const t of 'ilfda')
  for (let n = 0; n < 4; n++) add(`${t}load_${n}`, '', 'loads', '→ value', `Push the ${T[t]} in local variable ${n}. Single-byte shortcut for ${t}load ${n}.`);
for (const t of 'ilfdabcs') add(`${t}aload`, '', 'loads', 'arrayref, index → value', `Load a ${T[t]} from an array (throws on null or out-of-bounds).`);

// ---- stores 0x36–0x56
for (const t of 'ilfda') add(`${t}store`, 'B', 'stores', 'value →', `Pop a ${T[t]} into local variable #index.`);
for (const t of 'ilfda')
  for (let n = 0; n < 4; n++) add(`${t}store_${n}`, '', 'stores', 'value →', `Pop a ${T[t]} into local variable ${n}.`);
for (const t of 'ilfdabcs') add(`${t}astore`, '', 'stores', 'arrayref, index, value →', `Store a ${T[t]} into an array.`);

// ---- stack 0x57–0x5f
add('pop', '', 'stack', 'v →', 'Discard the top value (category-1).');
add('pop2', '', 'stack', 'v2, v1 →', 'Discard the top two slots (or one long/double).');
add('dup', '', 'stack', 'v → v, v', 'Duplicate the top value. Classic use: new + dup + invokespecial <init>.');
add('dup_x1', '', 'stack', 'v2, v1 → v1, v2, v1', 'Duplicate the top value and insert it two values down.');
add('dup_x2', '', 'stack', 'v3, v2, v1 → v1, v3, v2, v1', 'Duplicate the top value and insert it three slots down.');
add('dup2', '', 'stack', 'v2, v1 → v2, v1, v2, v1', 'Duplicate the top two slots (or one long/double).');
add('dup2_x1', '', 'stack', 'v3, v2, v1 → v2, v1, v3, v2, v1', 'dup2, inserted beneath the third slot.');
add('dup2_x2', '', 'stack', 'v4, v3, v2, v1 → v2, v1, v4, v3, v2, v1', 'dup2, inserted beneath the fourth slot.');
add('swap', '', 'stack', 'v2, v1 → v1, v2', 'Swap the top two category-1 values.');

// ---- math 0x60–0x84
const arith: [string, string, string][] = [
  ['add', '+', 'Add'],
  ['sub', '−', 'Subtract'],
  ['mul', '×', 'Multiply'],
  ['div', '÷', 'Divide (int/long throw ArithmeticException on ÷0)'],
  ['rem', '%', 'Remainder'],
];
for (const [op, sym, word] of arith)
  for (const t of 'ilfd') add(`${t}${op}`, '', 'math', `a, b → a ${sym} b`, `${word} two ${T[t]}s.`);
for (const t of 'ilfd') add(`${t}neg`, '', 'math', 'a → −a', `Negate a ${T[t]}.`);
const bits: [string, string, string][] = [
  ['shl', 'a << n', 'Shift left'],
  ['shr', 'a >> n', 'Arithmetic shift right'],
  ['ushr', 'a >>> n', 'Logical shift right'],
];
for (const [op, sym, word] of bits) for (const t of 'il') add(`${t}${op}`, '', 'math', `a, n → ${sym}`, `${word} a ${T[t]}.`);
for (const [op, sym] of [
  ['and', '&'],
  ['or', '|'],
  ['xor', '^'],
])
  for (const t of 'il') add(`${t}${op}`, '', 'math', `a, b → a ${sym} b`, `Bitwise ${op.toUpperCase()} of two ${T[t]}s.`);
add('iinc', 'Bb', 'math', '— → —', 'Add a signed byte to an int local variable in place — no stack traffic. This is i++.');

// ---- conversions 0x85–0x93
for (const [from, tos] of [
  ['i', 'lfd'],
  ['l', 'ifd'],
  ['f', 'ild'],
  ['d', 'ilf'],
] as const)
  for (const to of tos) add(`${from}2${to}`, '', 'conversions', 'value → result', `Convert ${T[from]} to ${T[to]}.`);
for (const to of 'bcs') add(`i2${to}`, '', 'conversions', 'value → result', `Truncate an int to ${T[to] === 'byte/boolean' ? 'byte' : T[to]} (and sign/zero-extend back to int).`);

// ---- comparisons 0x94–0xa6
add('lcmp', '', 'comparisons', 'a, b → -1|0|1', 'Compare two longs; push -1, 0 or 1.');
add('fcmpl', '', 'comparisons', 'a, b → -1|0|1', 'Compare floats; NaN gives -1.');
add('fcmpg', '', 'comparisons', 'a, b → -1|0|1', 'Compare floats; NaN gives 1.');
add('dcmpl', '', 'comparisons', 'a, b → -1|0|1', 'Compare doubles; NaN gives -1.');
add('dcmpg', '', 'comparisons', 'a, b → -1|0|1', 'Compare doubles; NaN gives 1.');
const conds: [string, string][] = [
  ['eq', '=='],
  ['ne', '!='],
  ['lt', '<'],
  ['ge', '>='],
  ['gt', '>'],
  ['le', '<='],
];
for (const [c, sym] of conds) add(`if${c}`, 'o', 'comparisons', 'value →', `Branch if int value ${sym} 0.`);
for (const [c, sym] of conds) add(`if_icmp${c}`, 'o', 'comparisons', 'a, b →', `Branch if int a ${sym} b. javac usually emits the inverse test to jump over the then-branch.`);
add('if_acmpeq', 'o', 'comparisons', 'a, b →', 'Branch if two references are identical (==).');
add('if_acmpne', 'o', 'comparisons', 'a, b →', 'Branch if two references differ.');

// ---- control 0xa7–0xb1
add('goto', 'o', 'control', '— → —', 'Unconditional jump by a signed 16-bit offset.');
add('jsr', 'o', 'control', '→ address', 'Jump to subroutine (legacy finally). Forbidden in class files ≥ v51.');
add('ret', 'B', 'control', '— → —', 'Return from subroutine (legacy, paired with jsr).');
add('tableswitch', '*', 'control', 'index →', 'Jump table for dense case ranges: O(1) lookup by index − low.');
add('lookupswitch', '*', 'control', 'key →', 'Sorted key/offset pairs for sparse cases: binary search.');
for (const t of 'ilfda') add(`${t}return`, '', 'control', 'value → [empty]', `Return a ${T[t]} to the caller's operand stack and pop this frame.`);
add('return', '', 'control', '→ [empty]', 'Return void from the method.');

// ---- references 0xb2–0xc3
add('getstatic', 'S', 'references', '→ value', 'Push a static field. May trigger class initialization.');
add('putstatic', 'S', 'references', 'value →', 'Set a static field.');
add('getfield', 'S', 'references', 'objectref → value', 'Push an instance field of objectref.');
add('putfield', 'S', 'references', 'objectref, value →', 'Set an instance field.');
add('invokevirtual', 'S', 'references', 'objectref, args… → result', 'Call an instance method, dispatched on the runtime class (vtable).');
add('invokespecial', 'S', 'references', 'objectref, args… → result', 'Call without virtual dispatch: constructors (<init>), private and super methods.');
add('invokestatic', 'S', 'references', 'args… → result', 'Call a static method. No receiver.');
add('invokeinterface', 'SB0', 'references', 'objectref, args… → result', 'Call an interface method (itable search). Carries a legacy arg-count byte and a zero.');
add('invokedynamic', 'S00', 'references', 'args… → result', 'Call site linked at runtime by a bootstrap method. Powers lambdas, string concat, records, pattern switch.');
add('new', 'S', 'references', '→ objectref', 'Allocate an uninitialized object. Must be initialized by invokespecial <init> before use.');
add('newarray', 'B', 'references', 'count → arrayref', 'Allocate a primitive array (atype 4=boolean … 11=long).');
add('anewarray', 'S', 'references', 'count → arrayref', 'Allocate an array of references.');
add('arraylength', '', 'references', 'arrayref → length', 'Push the length of an array.');
add('athrow', '', 'references', 'objectref → objectref', 'Throw an exception; the JVM searches the exception table, then unwinds frames.');
add('checkcast', 'S', 'references', 'objectref → objectref', 'Throw ClassCastException unless objectref is null or an instance of the type.');
add('instanceof', 'S', 'references', 'objectref → 0|1', 'Push 1 if objectref is a non-null instance of the type.');
add('monitorenter', '', 'references', 'objectref →', 'Acquire the object monitor (synchronized block entry).');
add('monitorexit', '', 'references', 'objectref →', 'Release the object monitor.');

// ---- extended 0xc4–0xc9
add('wide', '*', 'extended', 'same as modified instruction', 'Prefix: next load/store/ret/iinc uses a 16-bit local index (and iinc a 16-bit constant).');
add('multianewarray', 'SB', 'extended', 'count1, …, countN → arrayref', 'Allocate a multi-dimensional array.');
add('ifnull', 'o', 'extended', 'value →', 'Branch if reference is null.');
add('ifnonnull', 'o', 'extended', 'value →', 'Branch if reference is not null.');
add('goto_w', 'O', 'extended', '— → —', 'Unconditional jump with a 32-bit offset.');
add('jsr_w', 'O', 'extended', '→ address', 'jsr with a 32-bit offset (legacy).');

// ---- reserved
add('breakpoint', '', 'reserved', '', 'Reserved for debuggers.', 0xca);
add('impdep1', '', 'reserved', '', 'Reserved for implementation-specific use.', 0xfe);
add('impdep2', '', 'reserved', '', 'Reserved for implementation-specific use.', 0xff);

export const OPCODES: readonly Opcode[] = ops;
export const BY_CODE = new Map(ops.map((o) => [o.code, o]));
export const BY_NAME = new Map(ops.map((o) => [o.name, o]));

/** Byte length of an instruction whose operands are fixed-size. */
export function fixedLength(o: Opcode) {
  let n = 1;
  for (const c of o.operands) n += c === 'S' || c === 's' || c === 'o' ? 2 : c === 'O' ? 4 : 1;
  return n;
}

// Sanity check the family builder against well-known opcode values.
if (import.meta.env?.DEV) {
  const expect: Record<string, number> = { iconst_0: 0x03, bipush: 0x10, iload_0: 0x1a, aload_0: 0x2a, iaload: 0x2e, istore: 0x36, astore_3: 0x4e, sastore: 0x56, pop: 0x57, iadd: 0x60, iinc: 0x84, i2l: 0x85, i2s: 0x93, lcmp: 0x94, ifeq: 0x99, if_acmpne: 0xa6, goto: 0xa7, ireturn: 0xac, return: 0xb1, getstatic: 0xb2, invokedynamic: 0xba, new: 0xbb, monitorexit: 0xc3, wide: 0xc4, jsr_w: 0xc9 };
  for (const [n, c] of Object.entries(expect)) if (BY_NAME.get(n)?.code !== c) console.error(`opcode table mismatch: ${n} should be 0x${c.toString(16)}, got 0x${BY_NAME.get(n)?.code.toString(16)}`);
}

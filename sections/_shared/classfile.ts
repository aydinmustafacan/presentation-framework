/**
 * A class-file parser (JVMS §4) that records the byte range of every structure,
 * so a hex view can show what each byte means. Includes a bytecode disassembler.
 */
import { BY_CODE, fixedLength } from './opcodes.ts';

export type Group = 'header' | 'cp' | 'class' | 'field' | 'method' | 'attr' | 'code';

export interface Region {
  start: number;
  end: number; // exclusive
  group: Group;
  /** breadcrumb, e.g. ["Constant pool", "#7 Methodref"] */
  path: string[];
  label: string;
  value?: string;
}

export interface Disasm {
  offset: number;
  text: string;
  start: number;
  end: number;
}

export interface ParsedMethod {
  name: string;
  descriptor: string;
  access: string[];
  maxStack?: number;
  maxLocals?: number;
  code: Disasm[];
}

export interface ParsedClass {
  regions: Region[];
  version: { major: number; minor: number; java: string };
  thisClass: string;
  superClass: string;
  access: string[];
  cpCount: number;
  constants: { index: number; tag: string; text: string }[];
  methods: ParsedMethod[];
  fields: { name: string; descriptor: string; access: string[] }[];
}

const TAGS: Record<number, string> = {
  1: 'Utf8',
  3: 'Integer',
  4: 'Float',
  5: 'Long',
  6: 'Double',
  7: 'Class',
  8: 'String',
  9: 'Fieldref',
  10: 'Methodref',
  11: 'InterfaceMethodref',
  12: 'NameAndType',
  15: 'MethodHandle',
  16: 'MethodType',
  17: 'Dynamic',
  18: 'InvokeDynamic',
  19: 'Module',
  20: 'Package',
};

const CLASS_FLAGS: [number, string][] = [
  [0x0001, 'public'],
  [0x0010, 'final'],
  [0x0020, 'super'],
  [0x0200, 'interface'],
  [0x0400, 'abstract'],
  [0x1000, 'synthetic'],
  [0x2000, 'annotation'],
  [0x4000, 'enum'],
  [0x8000, 'module'],
];
const MEMBER_FLAGS: [number, string][] = [
  [0x0001, 'public'],
  [0x0002, 'private'],
  [0x0004, 'protected'],
  [0x0008, 'static'],
  [0x0010, 'final'],
  [0x0020, 'synchronized'],
  [0x0040, 'bridge/volatile'],
  [0x0080, 'varargs/transient'],
  [0x0100, 'native'],
  [0x0400, 'abstract'],
  [0x0800, 'strict'],
  [0x1000, 'synthetic'],
];
const flags = (v: number, table: [number, string][]) => table.filter(([b]) => v & b).map(([, n]) => n);

export function javaVersion(major: number) {
  return major >= 49 ? `Java ${major - 44}` : major === 48 ? 'Java 1.4' : `JDK 1.${major - 44}`;
}

export function parseClass(bytes: Uint8Array): ParsedClass {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 0;
  const regions: Region[] = [];
  const u1 = () => dv.getUint8(p++);
  const u2 = () => ((p += 2), dv.getUint16(p - 2));
  const u4 = () => ((p += 4), dv.getUint32(p - 4));
  const region = (start: number, group: Group, path: string[], label: string, value?: string) =>
    regions.push({ start, end: p, group, path, label, value });
  const need = (n: number) => {
    if (p + n > bytes.length) throw new Error(`truncated class file at byte ${p}`);
  };

  need(10);
  let s = p;
  const magic = u4();
  if (magic !== 0xcafebabe) throw new Error(`not a class file (magic is 0x${magic.toString(16)}, expected 0xCAFEBABE)`);
  region(s, 'header', ['Header'], 'magic', '0xCAFEBABE');
  s = p;
  const minor = u2();
  region(s, 'header', ['Header'], 'minor_version', String(minor));
  s = p;
  const major = u2();
  region(s, 'header', ['Header'], 'major_version', `${major} → ${javaVersion(major)}`);

  // ---- constant pool
  s = p;
  const cpCount = u2();
  region(s, 'cp', ['Constant pool'], 'constant_pool_count', `${cpCount} (entries 1…${cpCount - 1})`);
  type Entry = { tag: number; a?: number; b?: number; str?: string; num?: string };
  const cp: Entry[] = [];
  const cpStarts: number[] = [];
  for (let i = 1; i < cpCount; i++) {
    need(1);
    cpStarts[i] = p;
    const tag = u1();
    const e: Entry = { tag };
    switch (tag) {
      case 1: {
        const len = u2();
        need(len);
        e.str = utf8(bytes.subarray(p, p + len));
        p += len;
        break;
      }
      case 3:
        e.num = String(dv.getInt32(p));
        p += 4;
        break;
      case 4:
        e.num = String(dv.getFloat32(p));
        p += 4;
        break;
      case 5:
        e.num = String(dv.getBigInt64(p)) + 'L';
        p += 8;
        break;
      case 6:
        e.num = String(dv.getFloat64(p));
        p += 8;
        break;
      case 7:
      case 8:
      case 16:
      case 19:
      case 20:
        e.a = u2();
        break;
      case 15:
        e.a = u1();
        e.b = u2();
        break;
      case 9:
      case 10:
      case 11:
      case 12:
      case 17:
      case 18:
        e.a = u2();
        e.b = u2();
        break;
      default:
        throw new Error(`unknown constant-pool tag ${tag} at byte ${p - 1}`);
    }
    cp[i] = e;
    if (tag === 5 || tag === 6) i++; // longs and doubles take two slots
  }

  const resolve = (i: number, depth = 0): string => {
    const e = cp[i];
    if (!e || depth > 4) return `#${i}`;
    switch (e.tag) {
      case 1:
        return e.str!;
      case 3:
      case 4:
      case 5:
      case 6:
        return e.num!;
      case 7:
      case 16:
      case 19:
      case 20:
        return resolve(e.a!, depth + 1);
      case 8:
        return JSON.stringify(resolve(e.a!, depth + 1));
      case 9:
      case 10:
      case 11:
        return `${resolve(e.a!, depth + 1)}.${resolve(e.b!, depth + 1)}`;
      case 12:
        return `${resolve(e.a!, depth + 1)}:${resolve(e.b!, depth + 1)}`;
      case 15:
        return `handle(${e.a}) ${resolve(e.b!, depth + 1)}`;
      case 17:
      case 18:
        return `bootstrap#${e.a}:${resolve(e.b!, depth + 1)}`;
      default:
        return `#${i}`;
    }
  };

  const constants: ParsedClass['constants'] = [];
  for (let i = 1; i < cpCount; i++) {
    const e = cp[i];
    if (!e) continue;
    const tag = TAGS[e.tag];
    const refs = e.a !== undefined ? (e.b !== undefined ? `#${e.a}, #${e.b}` : `#${e.a}`) : '';
    const text = resolve(i);
    constants.push({ index: i, tag, text });
    const end = i + 1 < cpCount ? (cpStarts[i + 1] ?? cpStarts[i + 2] ?? p) : p;
    regions.push({
      start: cpStarts[i],
      end,
      group: 'cp',
      path: ['Constant pool', `#${i} ${tag}`],
      label: `#${i} ${tag}${refs ? ` → ${refs}` : ''}`,
      value: text,
    });
  }

  // ---- class info
  s = p;
  const access = flags(u2(), CLASS_FLAGS);
  region(s, 'class', ['Class'], 'access_flags', access.join(' '));
  s = p;
  const thisClass = resolve(u2());
  region(s, 'class', ['Class'], 'this_class', thisClass);
  s = p;
  const superIdx = u2();
  const superClass = superIdx ? resolve(superIdx) : '(none)';
  region(s, 'class', ['Class'], 'super_class', superClass);
  s = p;
  const ifCount = u2();
  region(s, 'class', ['Class'], 'interfaces_count', String(ifCount));
  for (let i = 0; i < ifCount; i++) {
    s = p;
    region(s, 'class', ['Class', 'Interfaces'], `interface[${i}]`, resolve(u2()));
  }

  // ---- attributes (shared by class, field, method, Code)
  function attributes(group: Group, path: string[], onCode?: (m: { maxStack: number; maxLocals: number; code: Disasm[] }) => void) {
    let s = p;
    const n = u2();
    region(s, group, path, 'attributes_count', String(n));
    for (let i = 0; i < n; i++) {
      s = p;
      const name = resolve(u2());
      const len = u4();
      need(len);
      const bodyStart = p;
      const apath = [...path, name];
      regions.push({ start: s, end: p, group: 'attr', path: apath, label: `${name} attribute header`, value: `${len} bytes follow` });
      if (name === 'Code' && onCode) {
        s = p;
        const maxStack = u2();
        region(s, 'attr', apath, 'max_stack', String(maxStack));
        s = p;
        const maxLocals = u2();
        region(s, 'attr', apath, 'max_locals', String(maxLocals));
        s = p;
        const codeLen = u4();
        region(s, 'attr', apath, 'code_length', `${codeLen} bytes of bytecode`);
        const code = disassemble(bytes, p, codeLen, resolve);
        for (const d of code) regions.push({ start: d.start, end: d.end, group: 'code', path: [...apath, 'bytecode'], label: `${d.offset}: ${d.text}` });
        p += codeLen;
        s = p;
        const exLen = u2();
        p += exLen * 8;
        region(s, 'attr', apath, 'exception_table', `${exLen} entr${exLen === 1 ? 'y' : 'ies'}`);
        attributes('attr', apath);
        onCode({ maxStack, maxLocals, code });
      } else {
        p = bodyStart + len;
        regions.push({ start: bodyStart, end: p, group: 'attr', path: apath, label: `${name} body`, value: describeAttr(name) });
      }
      if (p !== bodyStart + len) p = bodyStart + len;
    }
  }

  // ---- fields
  s = p;
  const fieldCount = u2();
  region(s, 'field', ['Fields'], 'fields_count', String(fieldCount));
  const fields: ParsedClass['fields'] = [];
  for (let i = 0; i < fieldCount; i++) {
    s = p;
    const acc = flags(u2(), MEMBER_FLAGS);
    const name = resolve(u2());
    const desc = resolve(u2());
    region(s, 'field', ['Fields', name], `field ${name}`, `${acc.join(' ')} ${desc}`);
    fields.push({ name, descriptor: desc, access: acc });
    attributes('field', ['Fields', name]);
  }

  // ---- methods
  s = p;
  const methodCount = u2();
  region(s, 'method', ['Methods'], 'methods_count', String(methodCount));
  const methods: ParsedMethod[] = [];
  for (let i = 0; i < methodCount; i++) {
    s = p;
    const acc = flags(u2(), MEMBER_FLAGS);
    const name = resolve(u2());
    const desc = resolve(u2());
    region(s, 'method', ['Methods', name], `method ${name}`, `${acc.join(' ')} ${desc}`);
    const m: ParsedMethod = { name, descriptor: desc, access: acc, code: [] };
    attributes('method', ['Methods', name + desc], (c) => Object.assign(m, c));
    methods.push(m);
  }

  attributes('class', ['Class attributes']);
  if (p !== bytes.length) throw new Error(`${bytes.length - p} unexpected trailing bytes`);

  return {
    regions: regions.sort((a, b) => a.start - b.start),
    version: { major, minor, java: javaVersion(major) },
    thisClass,
    superClass,
    access,
    cpCount,
    constants,
    methods,
    fields,
  };
}

function describeAttr(name: string): string {
  const d: Record<string, string> = {
    SourceFile: 'name of the .java file',
    LineNumberTable: 'bytecode offset → source line (stack traces, debuggers)',
    LocalVariableTable: 'local slot → variable name/type (javac -g)',
    StackMapTable: 'type state at branch targets — lets the verifier run in one pass',
    BootstrapMethods: 'bootstrap methods for invokedynamic call sites',
    InnerClasses: 'nested class relationships',
    NestMembers: 'classes allowed to share private access',
    Signature: 'generic type signature (erased at runtime)',
    MethodParameters: 'parameter names',
    Exceptions: 'checked exceptions in the throws clause',
  };
  return d[name] ?? '';
}

function utf8(b: Uint8Array) {
  try {
    return new TextDecoder().decode(b);
  } catch {
    return '…';
  }
}

export function disassemble(bytes: Uint8Array, base: number, len: number, resolve: (i: number) => string): Disasm[] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: Disasm[] = [];
  let pc = 0;
  while (pc < len) {
    const start = base + pc;
    const op = BY_CODE.get(bytes[start]);
    if (!op) {
      out.push({ offset: pc, text: `<bad opcode 0x${bytes[start].toString(16)}>`, start, end: start + 1 });
      pc++;
      continue;
    }
    let text = op.name;
    let size: number;
    if (op.name === 'tableswitch' || op.name === 'lookupswitch') {
      let q = pc + 1;
      q += (4 - (q % 4)) % 4;
      const def = dv.getInt32(base + q);
      if (op.name === 'tableswitch') {
        const low = dv.getInt32(base + q + 4);
        const high = dv.getInt32(base + q + 8);
        const targets = Array.from({ length: high - low + 1 }, (_, k) => `${low + k}→${pc + dv.getInt32(base + q + 12 + k * 4)}`);
        text += ` { ${targets.join(', ')}, default→${pc + def} }`;
        size = q + 12 + (high - low + 1) * 4 - pc;
      } else {
        const n = dv.getInt32(base + q + 4);
        const pairs = Array.from({ length: n }, (_, k) => `${dv.getInt32(base + q + 8 + k * 8)}→${pc + dv.getInt32(base + q + 12 + k * 8)}`);
        text += ` { ${pairs.join(', ')}, default→${pc + def} }`;
        size = q + 8 + n * 8 - pc;
      }
    } else if (op.name === 'wide') {
      const inner = BY_CODE.get(bytes[start + 1])!;
      const idx = dv.getUint16(start + 2);
      if (inner.name === 'iinc') {
        text = `wide iinc ${idx}, ${dv.getInt16(start + 4)}`;
        size = 6;
      } else {
        text = `wide ${inner.name} ${idx}`;
        size = 4;
      }
    } else {
      size = fixedLength(op);
      let q = start + 1;
      const parts: string[] = [];
      for (const c of op.operands) {
        if (c === 'b') parts.push(String(dv.getInt8(q++)));
        else if (c === 'B' && op.name === 'ldc') {
          const i = dv.getUint8(q++);
          parts.push(`#${i}`);
          text += `|${resolve(i)}`;
        } else if (c === 'B') parts.push(String(dv.getUint8(q++)));
        else if (c === 's') parts.push(String(dv.getInt16(q))), (q += 2);
        else if (c === 'S') {
          const i = dv.getUint16(q);
          parts.push(`#${i}`);
          q += 2;
          text += `|${resolve(i)}`;
        } else if (c === 'o') parts.push(String(pc + dv.getInt16(q))), (q += 2);
        else if (c === 'O') parts.push(String(pc + dv.getInt32(q))), (q += 4);
        else q++;
      }
      // move the resolved constant into a trailing comment
      const [name, ...comment] = text.split('|');
      text = `${name}${parts.length ? ' ' + parts.join(', ') : ''}${comment.length ? `  // ${comment.join(' ')}` : ''}`;
    }
    out.push({ offset: pc, text, start, end: start + size });
    pc += size;
  }
  return out;
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

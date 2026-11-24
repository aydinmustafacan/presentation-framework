import { useState } from 'react';
import { Slide, Code, Segmented, Tag } from '@framework';
import './style.css';

type Id = 'loader' | 'method' | 'heap' | 'stack' | 'pc' | 'native' | 'interp' | 'jit' | 'gc' | 'jni';

const PARTS: Record<Id, { name: string; scope?: 'shared' | 'per thread'; what: string; detail: string; holds?: string }> = {
  loader: {
    name: 'Class loader subsystem',
    what: 'Turns class-file bytes into runtime classes.',
    detail: 'Loads lazily on first use, verifies the bytecode, lays out static fields and resolves symbolic references. Loaders form a parent-delegation chain (bootstrap → platform → application). See 1.2.',
  },
  method: {
    name: 'Method area (Metaspace)',
    scope: 'shared',
    what: 'Per-class metadata: the runtime constant pool, field and method tables, the bytecode itself, and JIT-compiled code references.',
    detail: 'HotSpot stores it in native memory ("Metaspace") since Java 8, outside the Java heap. Classes are unloaded only when their class loader becomes unreachable.',
    holds: 'class Point { int x, y; … } + its bytecode',
  },
  heap: {
    name: 'Heap',
    scope: 'shared',
    what: 'Every object and array. Shared by all threads, managed by the garbage collector.',
    detail: 'Each object carries a header (mark word + class pointer) followed by its fields. Allocation is usually a pointer bump inside a thread-local allocation buffer (TLAB), which is why `new` is cheap.',
    holds: 'the Point object {x=3, y=4}',
  },
  stack: {
    name: 'JVM stacks',
    scope: 'per thread',
    what: 'One stack per thread, holding a frame for every method call in progress.',
    detail: 'A frame = local-variable array + operand stack + a reference to the class’s constant pool. Frames are pushed on call and popped on return; sizes (max_locals, max_stack) are known at compile time. Chapter 2 animates this.',
    holds: 'frame of main(): local p = ref → heap',
  },
  pc: {
    name: 'PC registers',
    scope: 'per thread',
    what: 'The address of the bytecode instruction the thread is executing.',
    detail: 'Undefined while the thread runs a native method. The interpreter keeps it in a real CPU register for speed.',
    holds: 'main() @ invokespecial Point.<init>',
  },
  native: {
    name: 'Native method stacks',
    scope: 'per thread',
    what: 'C stacks used when Java calls into native code via JNI.',
    detail: 'In HotSpot, Java frames and native frames actually share one thread stack.',
  },
  interp: {
    name: 'Interpreter',
    what: 'Executes bytecode one instruction at a time and collects profiles.',
    detail: 'HotSpot’s “template interpreter” is generated machine code at JVM start-up: one hand-tuned snippet per opcode, dispatched through a table.',
  },
  jit: {
    name: 'JIT compilers (C1, C2)',
    what: 'Compile hot methods to native code using the profiles.',
    detail: 'C1 compiles quickly with light optimisation; C2 (or Graal) inlines aggressively, removes allocations via escape analysis, and speculates on observed types. See 1.3.',
  },
  gc: {
    name: 'Garbage collector',
    what: 'Finds unreachable objects and reclaims their memory.',
    detail: 'Roots are the references in every frame’s locals and operand stack, static fields, and JNI handles. G1 is the default; ZGC and Shenandoah give sub-millisecond pauses.',
  },
  jni: {
    name: 'JNI / FFM & native libraries',
    what: 'The door to C code and the OS.',
    detail: 'Classic JNI or the newer Foreign Function & Memory API (Java 22+).',
  },
};

const EXAMPLE = `public static void main(String[] args) {
    Point p = new Point(3, 4);
    System.out.println(p.dist2());
}`;

export default function Page() {
  const [sel, setSel] = useState<Id>('stack');
  const [mode, setMode] = useState<'explore' | 'trace'>('explore');
  const p = PARTS[sel];

  const box = (id: Id, extra = '') => (
    <button className={`arch-box ${extra} ${sel === id ? 'is-on' : ''} ${mode === 'trace' && PARTS[id].holds ? 'is-traced' : ''}`} onClick={() => setSel(id)} onMouseEnter={() => setSel(id)}>
      <span className="arch-name">{PARTS[id].name}</span>
      {mode === 'trace' && PARTS[id].holds && <span className="arch-holds">{PARTS[id].holds}</span>}
    </button>
  );

  return (
    <Slide lead="Three subsystems: one turns bytes into classes, one holds the program’s state while it runs, one executes. Hover any part.">
      <div className="row">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'explore', label: 'Explore the parts' },
            { value: 'trace', label: 'Where does each thing live?' },
          ]}
        />
      </div>

      <div className="arch">
        <div className="arch-col">
          <div className="arch-group-label">Class loader subsystem</div>
          {box('loader', 'tall')}
        </div>

        <div className="arch-col arch-runtime">
          <div className="arch-group-label">Runtime data areas</div>
          <div className="arch-shared">
            <div className="arch-scope">
              <Tag tone="accent">shared by all threads</Tag>
            </div>
            {box('method')}
            {box('heap')}
          </div>
          <div className="arch-thread">
            <div className="arch-scope">
              <Tag tone="blue">one per thread</Tag>
            </div>
            <div className="arch-thread-row">
              {box('stack')}
              {box('pc')}
              {box('native')}
            </div>
          </div>
        </div>

        <div className="arch-col">
          <div className="arch-group-label">Execution engine</div>
          {box('interp')}
          {box('jit')}
          {box('gc')}
          {box('jni', 'is-ext')}
        </div>
      </div>

      <div className="arch-detail" key={sel}>
        <div>
          <div className="row">
            <h3>{p.name}</h3>
            {p.scope && <Tag tone={p.scope === 'shared' ? 'accent' : 'blue'}>{p.scope}</Tag>}
          </div>
          <p className="arch-what">{p.what}</p>
          <p className="muted">{p.detail}</p>
        </div>
        {mode === 'trace' ? (
          <div>
            <div className="w-cap">While this line runs…</div>
            <Code code={EXAMPLE} lang="java" active={2} />
            <p className="small muted" style={{ marginTop: 8 }}>
              Highlighted boxes show where each piece of <code>new Point(3, 4)</code> is stored.
            </p>
          </div>
        ) : null}
      </div>
    </Slide>
  );
}

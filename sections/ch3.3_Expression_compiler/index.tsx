import { useMemo, useState, type ReactNode } from 'react';
import { Slide, Card, Code, Button, Tag, Callout } from '@framework';
import { parse, variables, evaluate, compileStack, compileRegister, layout, ParseError, type LaidOut } from '../_shared/expr.ts';
import { Bars, NumberInputs } from '../_shared/widgets.tsx';
import './style.css';

const PRESETS = ['(a + b) * c', 'a * b + c * d', '(a - 1) * (b + 2) / c', 'a + b + c + d + e', '-(a * 100) % (b + 300)', 'a * (b * (c * (d * 2)))'];

export default function Page() {
  const [src, setSrc] = useState('a * b + c * d');
  const [env, setEnv] = useState<Record<string, number>>({ a: 3, b: 4, c: 5, d: 6, e: 7, f: 8, g: 9, h: 10 });
  const [hover, setHover] = useState<number | null>(null);

  const result = useMemo(() => {
    try {
      const ast = parse(src);
      const vars = variables(ast).sort();
      return { ok: true as const, ast, vars, stack: compileStack(ast, vars), reg: compileRegister(ast, vars), tree: layout(ast) };
    } catch (e) {
      return { ok: false as const, error: e as Error };
    }
  }, [src]);

  if (!result.ok) {
    return (
      <Shell src={src} setSrc={setSrc}>
        <Callout tone="red" title="Parse error">
          {result.error.message}
          {result.error instanceof ParseError && <span className="mono"> at column {result.error.pos + 1}</span>}
        </Callout>
      </Shell>
    );
  }

  const { ast, vars, stack, reg, tree } = result;
  let value: string;
  try {
    value = String(evaluate(ast, env));
  } catch (e) {
    value = (e as Error).message;
  }
  const activeStack = stack.code.map((c, i) => (c.node === hover ? i + 1 : 0)).filter(Boolean);
  const activeReg = reg.code.map((c, i) => (c.node === hover ? i + 1 : 0)).filter(Boolean);
  const sBytes = stack.code.reduce((n, c) => n + c.bytes, 0);
  const rBytes = reg.code.reduce((n, c) => n + c.bytes, 0);

  return (
    <Shell src={src} setSrc={setSrc}>
      <div className="ec-grid">
        <Card title="Expression tree" aside={<span className="faint small">hover a node</span>}>
          <Tree tree={tree.tree} width={tree.width} depth={tree.depth} hover={hover} setHover={setHover} />
          <div className="row" style={{ marginTop: 10 }}>
            {vars.length > 0 && (
              <NumberInputs
                names={vars}
                values={vars.map((v) => env[v])}
                onChange={(vals) => setEnv({ ...env, ...Object.fromEntries(vars.map((v, i) => [v, vals[i]])) })}
              />
            )}
            <span className="spacer" />
            <Tag tone="green">= {value}</Tag>
          </div>
        </Card>
        <Card title="Stack code (JVM)" tone="accent" aside={<Tag tone="accent">max_stack {stack.maxStack}</Tag>}>
          <Code
            code={stack.code.map((c) => `${c.text.padEnd(14)}// ${c.bytes}B`).join('\n')}
            lang="jvm"
            active={activeStack}
            dim={hover !== null}
            onHoverLine={(l) => setHover(l ? stack.code[l - 1].node : null)}
          />
        </Card>
        <Card title="Register code (Dalvik)" tone="blue" aside={<Tag tone="blue">{reg.temps} temp register{reg.temps === 1 ? '' : 's'}</Tag>}>
          <Code
            code={reg.code.map((c) => `${c.text.padEnd(26)}; ${c.bytes}B`).join('\n')}
            lang="asm"
            active={activeReg}
            dim={hover !== null}
            onHoverLine={(l) => setHover(l ? reg.code[l - 1].node : null)}
          />
          <p className="faint small" style={{ marginTop: 8 }}>
            Parameters {vars.map((v, i) => `${v}→p${i}`).join(', ') || '—'}
          </p>
        </Card>
      </div>
      <Card title="Cost">
        <Bars
          rows={[
            { label: 'instructions', stack: stack.code.length, reg: reg.code.length },
            { label: 'bytes', stack: sBytes, reg: rBytes, unit: ' B' },
          ]}
        />
      </Card>
    </Shell>
  );
}

function Shell({ src, setSrc, children }: { src: string; setSrc: (s: string) => void; children: ReactNode }) {
  return (
    <Slide lead="One parser, two back-ends. Type any integer expression over a–h. The stack back-end is a post-order walk; the register back-end has to decide where every intermediate value lives.">
      <div className="ec-input">
        <input className="text-input mono" value={src} onChange={(e) => setSrc(e.target.value)} spellCheck={false} aria-label="Expression" />
        <div className="row">
          {PRESETS.map((p) => (
            <Button key={p} variant="ghost" onClick={() => setSrc(p)} className="mono small">
              {p}
            </Button>
          ))}
        </div>
      </div>
      {children}
    </Slide>
  );
}

function Tree({ tree, width, depth, hover, setHover }: { tree: LaidOut; width: number; depth: number; hover: number | null; setHover: (n: number | null) => void }) {
  const SX = 56;
  const SY = 60;
  const W = Math.max(width * SX, 200);
  const H = depth * SY;
  const ox = (W - width * SX) / 2 + SX / 2;
  const nodes: LaidOut[] = [];
  const walk = (n: LaidOut) => {
    nodes.push(n);
    n.children.forEach(walk);
  };
  walk(tree);
  const px = (n: LaidOut) => ox + n.x * SX;
  const py = (n: LaidOut) => 22 + n.y * SY;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ec-tree" style={{ maxHeight: 300 }}>
      {nodes.flatMap((n) => n.children.map((c) => <line key={`${n.node.id}-${c.node.id}`} x1={px(n)} y1={py(n)} x2={px(c)} y2={py(c)} className="ec-edge" />))}
      {nodes.map((n) => (
        <g
          key={n.node.id}
          transform={`translate(${px(n)},${py(n)})`}
          className={`ec-node k-${n.node.kind} ${hover === n.node.id ? 'is-on' : ''}`}
          onMouseEnter={() => setHover(n.node.id)}
          onMouseLeave={() => setHover(null)}
        >
          <circle r={17} />
          <text dy={5} textAnchor="middle">
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

# UI kit reference (`@framework`)

Source: `framework/ui/index.tsx`, `framework/ui/highlight.ts`, `framework/ui/page.css`. Every React page imports `page.css` automatically, so there's nothing to set up.

## Layout

| Component | Props | Notes |
| --- | --- | --- |
| `Slide` | `title?`, `lead?`, `center?`, `width?` (default 1180), `children` | Header shows "Section 1.2" / "Chapter 1" + title from the folder name. Pass `title` only to style it (e.g. a highlighted word on a cover). `lead` = one or two sentences, max ~760px wide. Body is a vertical flex column with 18px gaps. |
| `Grid` | `cols` (number or a CSS template like `"1fr 1fr 220px"`), `gap?`, `style?` | Collapses to one column under 860px. |
| `Card` | `title?`, `aside?` (right side of header), `tone?`, `className?`, `style?` | The basic panel. Card titles render small-caps-ish and muted; `tone` colours the border + title. |
| `Callout` | `tone?`, `title?`, `children` | Left-bordered note. Good for "why it matters", caveats, honest labelling. |
| `Tag` | `tone?`, `title?` | Small pill: counts, sizes, labels. |
| `Stat` | `label`, `value`, `tone?`, `hint?` | Big number tile. Use a row of 3–4 under a simulator for live counters. |

`Tone` = `'accent' | 'blue' | 'green' | 'red' | 'violet' | 'muted'`.

## Controls

| Component | Props |
| --- | --- |
| `Button` | all `<button>` props + `variant?: 'default' \| 'primary' \| 'ghost'` |
| `Segmented<T>` | `options: {value, label}[]`, `value`, `onChange`, `label?` — the standard way to pick an example/program/mode |

Text/number inputs: style with `className="text-input"` only if you include `sections/_shared/widgets.css` (JVM deck) or copy that rule; otherwise write a small rule in the page CSS using `--border-strong`, `--panel`, `--accent` for focus.

## Stepping

```ts
const st = useStepper(total, initialSpeedMs?);
// st.step, st.total, st.playing, st.atEnd, st.speed
// st.next(), st.prev(), st.reset(), st.goTo(n), st.toggle(), st.play(), st.pause(), st.setSpeed(ms)
<StepControls stepper={st} label?={'instruction 12'} />
```

`total` is the number of **states** (`trace.length`), states are `0 … total-1`. Autoplay stops at the end. `StepControls` renders reset / back / play-pause / step / speed slider and binds keys inside the page: **Space** play/pause, **.** step, **,** back. When `total` changes (new inputs), call `st.reset()` in the same handler.

## Code

```tsx
<Code code={text} lang="java" active={[3, 4]} dim numbers onHoverLine={(l) => …} onClickLine={(l) => …} />
```

- `lang`: `'java' | 'ts'` (C-like), `'py'` (Python), `'xml'` (pom.xml, HTML-ish), `'jvm'` (javap-style: `12: iload_1 #3 // comment`), `'asm'` (register code: `add-int v0, p0, p1 ; comment`, `:labels`), `'text'`.
- `active`: 1-based line(s) to highlight; `dim` fades the others (only when something is active).
- `onHoverLine(line | null)` / `onClickLine(line)` make lines interactive — the basis of hover cross-linking.
- `highlight(line, lang)` and `opcodeCategory(op)` are exported if you need them elsewhere.
- For other languages, `ts`/`java` work acceptably for most C-family code; for anything else use `text` or extend `highlight.ts` (keep it tiny and dependency-free).

## Context

`useSection()` → `{ id: 'ch1.2', number: '1.2', title: 'Mark and sweep' }`.

## CSS variables and light/dark mode

Every deck supports a light and a dark theme. The shell sets `data-theme="light|dark"` on each page's `<html>` (toggle button or **T**; default follows the OS; remembered in localStorage). `page.css` defines both palettes, so **a page that uses only these variables gets light mode for free**. Never hard-code a colour (`#0a0c10`, `white`, `rgba(…)`) in page CSS or inline styles: it will be wrong in one of the two themes.

```
surfaces  --bg --panel --panel-2 --code-bg --hover --code-hover --stripe
lines     --border --border-strong --hover-border
text      --text --text-2 (body copy in panels) --muted --faint --inline-code
colours   --accent --accent-hover --blue --green --red --violet --teal --yellow
on fills  --on-fill   (text on an --accent/--blue background)
syntax    --tk-kw --tk-type --tk-str --tk-num --tk-com --tk-fn --tk-branch --tk-invoke --tk-obj --tk-stack
fonts     --ui --mono   · --radius
```

Recipes:
- Tints: `color-mix(in srgb, var(--accent) 15%, transparent)` or `… var(--panel))`, not `rgba(242,158,76,.15)`.
- A per-item category colour (a pastel hex from TS, e.g. opcode categories) goes in a `--c` custom property: `style={{ '--c': color } as CSSProperties}`. Use it directly for fills/borders, and for **text** use `color: color-mix(in srgb, var(--c), var(--ink-mix) var(--ink-amt))`, which lightens it on dark and darkens it on light so it stays readable.
- In TS colour tables prefer `'var(--green)'` strings. In SVG, set colours through `style={{ fill: … }}`, because `fill="var(--x)"` attributes don't resolve variables.
- A dropped-in HTML page keeps its own CSS. To make it theme-aware, add a `:root[data-theme="light"] { … }` block overriding its variables (see `sections/ch4.4_Check_your_understanding.html`). The injected bridge sets the attribute; standalone, it follows the OS.

Dark values (light values are in `framework/ui/page.css`): `--bg #0c0e12`, `--panel #12151b`, `--accent #f29e4c` (orange), `--blue #5cb8ff`, `--green #5fd08f`, `--red #ff6f6f`, `--violet #b493ff`.

Utility classes: `.row` (flex, wrap, gap 10), `.spacer` (flex 1), `.muted`, `.faint`, `.mono`, `.small`. Tones as a variable: any element with `className="tone-blue"` gets `--tone`.

Fonts are system stacks on purpose — pages must work offline, so don't add web-font links.

Give the deck's own colour meaning and keep it consistent: in the JVM deck orange = stack/JVM, blue = register machine, green = result/written, violet = math/stats. Decide a mapping for a new deck early (e.g. orange = "the thing being explained", blue = "the alternative").

## Showing a real project's files

If the deck is about a real example project kept inside the deck (e.g. `decks/graalpy/example/`), import its files as text with Vite's `?raw` (`import pom from '../../example/app/pom.xml?raw'`) and find lines by content (`lineOf(src, 'def handle(')`) instead of hard-coding line numbers, so a code change can't silently desync the slides. See `decks/graalpy/sections/_shared/sources.ts`. For long code in a scrolling pane, wrap `<Code>` so the active line scrolls into view (`AutoScroll` in `decks/graalpy/sections/_shared/ui.tsx`).

## Shared JVM-deck widgets you can copy

`sections/_shared/widgets.tsx` (+ `widgets.css`) in the root deck has `OperandStack`, `Locals`, `Registers`, `Note` (explanation box), `NumberInputs`, and `Bars` (paired horizontal comparison bars). They're tuned for the JVM topic, but `Note`, `NumberInputs` and `Bars` are generic: copy them into the new deck's `_shared/` rather than importing across decks, so each deck stays self-contained.

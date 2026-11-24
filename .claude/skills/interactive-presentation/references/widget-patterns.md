# Widget patterns

Patterns that worked in the JVM deck, with the files to look at. Reuse the shape, not the topic.

## Simulator = precomputed trace

Don't animate by mutating state in effects. Write a pure function that runs the whole process and returns **one snapshot per step**, then let `useStepper` index into the array.

```ts
interface Snapshot { /* full visible state */ note: string; done: boolean; stats: {...} }
export function run(input): Snapshot[] { ... clone state after every step ... }
```

Why: stepping backwards is free, autoplay is just an index, the UI is a pure function of `trace[step]`, and the logic is testable with `npx tsx` without a browser. Clone deeply per snapshot (arrays of small objects are fine; traces of a few hundred steps are cheap). Cap the length (e.g. 600) so a bad input can't hang the page, and bound inputs (`min`/`max`) so traces stay readable.

Each snapshot carries a **`note`**: one or two sentences saying what just happened *and why it matters* ("Pop two ints (3 and 4), push 7. No operands in the instruction — both inputs are implicit."). The note is where the teaching happens; the visuals make it believable.

See: `sections/_shared/stackvm.ts`, `regvm.ts`, `sections/ch2.2_Bytecode_stepper/index.tsx`.

## Highlight what just happened

Highlight the element that produced the current state (the executed instruction, the changed variable, the pushed value), not the next one, so the note and the picture agree. Animate only the change: newly pushed items slide in, changed values flash. Give animated elements a `key` that includes their value so React re-mounts them and the CSS animation replays.

## Lock-step comparison

Run two simulators on the same input and step them with one shared index: `a = A[min(step, A.length-1)]`, `b = B[…]`. The faster one visibly finishes first. Finish with totals as paired bars. See `sections/ch3.2_Side_by_side_race/`.

## Input → two outputs

One parser, two back-ends, live as the user types (`sections/ch3.3_Expression_compiler/`, `_shared/expr.ts`): parse in `useMemo`, catch errors and show them inline with the column, give every AST node an `id`, and have every emitted line remember the node it came from. Hovering a node highlights its lines in both outputs, and hovering a line highlights the node. Provide 4–6 preset inputs as buttons; most people won't type.

## Hover cross-linking between two views

Keep a mapping (source line ↔ output rows) and drive both `Code` blocks' `active` from one hovered value. In the JVM deck the mapping is the real LineNumberTable (`sections/ch4.3_From_Java_to_bytecode/`). Reset hover state when the example changes.

## Explorable diagram

Boxes as `<button>`s laid out with CSS grid, a selected id in state, and a detail panel below that changes on hover/click. Add a second mode that overlays a concrete example ("where does each thing live?"). See `sections/ch1.1_Architecture/`.

## Parameter sliders with a live verdict

When the honest answer is "it depends", let the audience set the weights and show who wins per case (`sections/ch3.4_Trade-offs/`). Compute from measured data, not made-up numbers.

## Ambient cover animation

Covers can loop a tiny demo (`sections/ch2_Stack_machines/`). Use `play()`/`reset()` from `useStepper` in an effect keyed on `[step, atEnd]` — not `toggle()`, because React StrictMode runs effects twice in dev and two toggles cancel out.

## Binary / structured data viewers

Parse into a flat list of regions `{start, end, group, path, label, value}` covering every byte, then colour each byte by its region and show the hovered region's breadcrumb + value (`_shared/classfile.ts`, `sections/ch4.1_Class_file_anatomy/`). Assert in a test script that every byte is covered. Accept a dropped file (`onDrop` + `arrayBuffer()`) so people can inspect their own data. Memoize the decoded bytes so hover re-renders don't re-parse.

## Keyboard rules

- **←/→, PageUp/PageDown, Home/End, S, F belong to the shell** (section navigation, sidebar, fullscreen). They are forwarded out of the page iframe unless the page calls `e.preventDefault()` or focus is in an input.
- Widgets use **Space / . / ,** (built into `StepControls`). The shell passes these three keys into the current page when the shell has focus, so a page's own handler should listen on `window` `keydown`, as `StepControls` does. If a widget truly needs arrows (a game, a canvas), call `preventDefault()` in its handler.

## Quizzes and drop-ins

A check-yourself quiz works well as a plain HTML page (no build step, easy to edit or replace): see `sections/ch4.4_Check_your_understanding.html`. Explain *why* each answer is right; link back to the section that covers it ("see 3.2").

## React gotchas seen in practice

- StrictMode double-invokes effects in dev: effects must be idempotent (see the cover-animation note).
- Inline `type ReactNode` / `type CSSProperties` imports from `'react'`; the `React.` namespace isn't global.
- Values derived from props each render (decoded arrays, parsed ASTs) go in `useMemo`, or every hover re-parses.
- Unicode escapes like ` ` inside regex literals: write them as escapes in a character class (`/[  ]/`), and make sure the file contains the escape text, not the raw character.

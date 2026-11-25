---
name: interactive-presentation
description: Build or extend interactive, explorable presentations with this project's framework, where every section is a standalone single-file Vite + React + TypeScript page shown in a sidebar shell. Use this whenever the user wants a presentation, deck, talk, lecture, explainer or tutorial in this repo — e.g. "make a presentation about how garbage collection works", "add a section on X with an interactive demo", "put this downloaded HTML page into chapter 2", "add a widget that simulates Y" — even if they don't say "framework" or "section".
---

# Interactive presentations

This repo is a presentation framework. A presentation ("deck") is a folder of sections; each section is its own small React app that builds to **one self-contained HTML file**, and a shell shows them with a sidebar. The example deck at the project root ("Inside the Java Virtual Machine", `./sections`) shows the quality bar: every section teaches one idea, and most let the audience *do* something — step through a machine, type an input, hover to cross-reference.

Read `README.md` once for the mechanics. This skill is about making good decks with it.

## 1. Decide where the work goes

| Request | Where |
| --- | --- |
| A **new** presentation on a new topic | a new deck: `decks/<kebab-slug>/sections/` + `decks/<slug>/presentation.json`. Never delete or overwrite the root JVM deck to make room. |
| Add to / change the JVM deck | `./sections/` |
| Add to another existing deck | `decks/<slug>/sections/` |

Every command takes the deck from the `DECK` env var (unset = root deck):

```bash
DECK=decks/gc npm run dev            # dev server with HMR, opens the shell
DECK=decks/gc npm run new -- 1.2 "Mark and sweep"   # scaffold a React section
DECK=decks/gc npm run build          # -> dist/gc/  (index.html, pages/, presentation.html)
npm run typecheck
```

## 2. Plan the outline before writing pages

Draft chapters and sections first (a short list in your head or in chat if the request is open-ended). Good outlines:

- **One idea per section.** If a section needs two headings to explain, split it.
- **Chapter covers** (`ch2_<Title>`) set the chapter title in the sidebar and frame the chapter in ~30 seconds. A chapter without a cover takes its title from `presentation.json` → `"chapters": { "2": "Title" }`.
- **Build up**: concept → mechanism you can step through → comparison/trade-offs → check-yourself (quiz).
- **Decide the widget for each section** — what will the audience manipulate, and what does it reveal that a static slide couldn't? Typical widgets: step-through simulator, side-by-side comparison running in lock-step, input → transformed output (a "compiler"), hover cross-highlighting between two views, a parameter slider with a live verdict, a clickable diagram with a detail panel. Not every section needs one; a cover or a trade-off table can be static.

A typical deck is 3–5 chapters × 2–4 sections. Size to the request: "a quick deck" ≈ 5–8 sections.

## 3. Naming = configuration

Everything in the deck's `sections/` named `ch<number>_<Title_With_Underscores>` becomes a page, ordered by number, titled from the name (underscores → spaces, hyphens kept):

- `ch1_Intro/index.tsx` → chapter 1 cover · `ch1.2_Mark_and_sweep/index.tsx` → section 1.2 · `ch1.2.1_…` → nested
- `ch3.4_Quiz.html` → a dropped-in standalone HTML page
- `_shared/` (any `_` prefix) → ignored; put code shared between pages here and import it relatively (`../_shared/sim.ts`)

Section numbers must be unique; the build fails loudly on duplicates.

## 4. Writing a React section

`index.tsx` default-exports a component. Start from `<Slide>`, which renders "Section 1.2" + the title from the folder name, so don't repeat the title.

```tsx
import { useMemo, useState } from 'react';
import { Slide, Card, Code, StepControls, useStepper } from '@framework';
import { run } from '../_shared/sim.ts';
import './style.css';

export default function Page() {
  const [n, setN] = useState(4);
  const trace = useMemo(() => run(n), [n]);     // precompute every state
  const st = useStepper(trace.length);           // index into it
  const snap = trace[st.step];
  return (
    <Slide lead="One sentence: what the audience should understand after this page.">
      {/* visual state from snap */}
      <StepControls stepper={st} />
    </Slide>
  );
}
```

The UI kit (`Slide`, `Card`, `Grid`, `Callout`, `Tag`, `Stat`, `Button`, `Segmented`, `Code` with highlighting/line hover, `useStepper` + `StepControls`) and the CSS variables are documented in `references/ui-kit.md`. Read it before writing pages. Per-page CSS goes in a `style.css` next to `index.tsx`. Use only the theme variables (`--panel`, `--text`, `--accent`, `--blue`, …), never literal colours: every deck has a light and a dark mode, and a hard-coded `#0a0c10` or `white` breaks one of them.

For widget architecture (simulators as precomputed snapshot traces, lock-step comparisons, hover-linking two views, keyboard rules, React gotchas) read `references/widget-patterns.md` before building anything interactive.

## 5. Dropping in an existing HTML page

When the user hands you a downloaded/standalone `.html` file:

1. Read the whole file first — it will be published inside the deck.
2. Check it is self-contained: look for `src=`/`href=` pointing at relative files (`./assets/…`, `images/…`). Those won't load once moved; inline them (data URIs) or tell the user what's missing. Absolute `https://` CDN links work only online — mention that if the deck must work offline.
3. Copy it to `sections/ch<n>_<Title>.html` (keep the original elsewhere untouched). Nothing else to configure; the framework injects a small script so arrow-key navigation still works.

A folder `ch<n>_<Title>/index.html` (with no `index.tsx`) also works.

## 6. Accuracy is part of the design

A deck that teaches something wrong is worse than no deck. So:

- **Generate real data when a tool exists.** The JVM deck compiles real Java with `javac`/`javap` (`sections/_shared/java/generate.mjs` → `bytecode.generated.json`) and the simulators execute that output. Do the same for any topic with a runnable source of truth (compilers, `python -m dis`, `objdump`, SQL `EXPLAIN`, a real algorithm run). Commit the generator script and its output, and add an npm script for it.
- **Test the logic outside React.** Put simulators/parsers in `_shared/*.ts` as pure functions and run them with a throwaway script via `npx tsx <file>.ts < /dev/null` before building UI on them. Check results against known answers.
- **Label what isn't real.** Hand-written examples or illustrative numbers get a visible note on the slide ("costs are illustrative; thresholds are HotSpot defaults").
- After writing explanatory text that describes generated data ("the dup keeps `this` for putfield"), re-check it against the actual data.

## 7. Verify before reporting

1. `npm run typecheck` — clean.
2. `DECK=… npm run build` — every section listed with ✓; note `presentation.html` size.
3. Open the dev server in a browser (if browser tools are available) and visit every section (`http://localhost:5173/#ch1.2`). For each: no Vite error overlay, `<h1>` present, interact with the main widget at least once. Press **T** and check the key pages in the other theme too. Screenshot the key widgets. A quick way to sweep all pages is to set `location.hash` in a loop from the shell and inspect `document.querySelector('iframe').contentDocument`.
4. Stop any servers you started.

Then tell the user: where the deck lives, the section list, how to run it (`DECK=… npm run dev`), where `presentation.html` is (a single file that runs offline by double-clicking), and anything illustrative or unverified.

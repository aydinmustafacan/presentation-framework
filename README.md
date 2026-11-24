# Presentation framework

Every section of a presentation is its **own standalone page**: a small Vite + React + TypeScript app that builds to **one self-contained HTML file** (JS and CSS inlined). A navigation shell shows the sections in a sidebar and loads them one at a time.

You can also drop in any **pre-built single-file HTML page** (e.g. one you downloaded) just by naming it correctly.

```
npm install
npm run dev        # live dev server with HMR on every page
npm run build      # dist/ — every page as a single file + the shell
npm run new -- 2.4 "Garbage collection"   # scaffold a React section
```

## Several decks in one project

The root deck lives in `./sections` + `./presentation.json`. Put any other deck in `decks/<name>/` (with its own `sections/` and `presentation.json`) and select it with `DECK`:

```
DECK=decks/binary-search npm run dev
DECK=decks/binary-search npm run build    # -> dist/binary-search/
```

The project skill `.claude/skills/interactive-presentation` tells Claude how to plan and build new decks with this framework; just ask for a presentation.

## Adding sections

Everything in `sections/` named `ch<number>_<title>` becomes a page. The number sets the order, the rest becomes the title (underscores → spaces).

| What you add                                   | What it becomes                         |
| ---------------------------------------------- | --------------------------------------- |
| `sections/ch1_Introduction/index.tsx`          | chapter 1's cover page, titled "Introduction" |
| `sections/ch1.2_The_heap/index.tsx`            | React section 1.2 "The heap"            |
| `sections/ch1.3_Some_demo.html`                | a dropped-in HTML page, section 1.3     |
| `sections/ch2.1.1_Deeper/index.tsx`            | nested section, indented in the sidebar |
| `sections/_shared/`, `sections/_anything`      | ignored (`_` prefix): code shared by pages |

- **React section:** a folder with `index.tsx` that default-exports a component. Import the UI kit with `import { Slide, Card, Code, … } from '@framework'`. `<Slide>` shows the number and title from the folder name automatically. Put CSS, images, etc. next to it and import them; they are inlined.
- **Dropped-in HTML:** any self-contained `.html` file. Nothing to configure; it’s copied as-is (a tiny script is injected so arrow keys still move between sections).
- **Chapter titles** come from the chapter’s cover page (`ch2_<title>`), or from `presentation.json`:

```json
{ "title": "My talk", "subtitle": "…", "chapters": { "4": "Java bytecode deep dive" } }
```

## Output

`npm run build` writes:

- `dist/pages/ch1.2.html` — every section as a single standalone file
- `dist/index.html` + `dist/manifest.json` — the shell; serve `dist/` over HTTP (`npm run preview`)
- `dist/presentation.html` — shell **and every page embedded in one file**. Works by double-clicking (`file://`), emailing, or a USB stick.

## Presenting

`←` `→` (or PageUp/PageDown) move between sections, `Home`/`End` jump, `S` toggles the sidebar, `F` fullscreen. These work even while focus is inside a page. Pages that use arrow keys themselves can call `e.preventDefault()` and the shell won’t react. The step widgets use `Space` (play/pause), `.` (step) and `,` (back).

## How it works

```
framework/
  sections.ts      discovers sections/ and builds the manifest
  pages.ts         generates each React page's entry + the key-forwarding bridge
  vite-plugin.ts   dev server: /manifest.json and /pages/<id>.html (with HMR)
  build.ts         builds each page with vite-plugin-singlefile, then the shell
  shell/           the navigation app (sidebar, top bar, iframe)
  ui/              the page UI kit (@framework): Slide, Card, Code, StepControls…
```

Each page is rendered in an iframe, so pages are fully isolated from each other: one page’s CSS or globals can’t leak into another, and a dropped-in page behaves exactly as it does on its own.

## The example deck: Inside the JVM

- **1** Architecture, class loading (parent delegation, link phases), tiered JIT compilation
- **2** Stack machines: frames and the call stack, a step-by-step bytecode interpreter
- **3** Stack vs register machines: register-VM stepper, a lock-step race, an expression compiler with both back-ends, trade-offs
- **4** Bytecode deep dive: a class-file hex viewer (drop in your own `.class`), the full opcode map, Java → bytecode with line mapping, and a plain-HTML quiz (`ch4.4_…html`)

The JVM bytecode is real `javac` output. `sections/_shared/java/examples/*.java` are compiled by `npm run gen:bytecode` (needs a JDK) into `sections/_shared/bytecode.generated.json`; the simulators execute that output. The register-machine code is hand-written in Dalvik’s format (Dalvik's instruction names, operand forms and sizes), since generating it with d8 would need the Android SDK.

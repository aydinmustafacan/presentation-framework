/**
 * Scaffold a React section:   npm run new -- 2.4 "Garbage collection"
 */
import fs from 'node:fs';
import path from 'node:path';
import { SECTIONS_DIR, discoverSections } from './sections.ts';

const [number, ...titleWords] = process.argv.slice(2);
const title = titleWords.join(' ').trim();

if (!number || !/^\d+(\.\d+)*$/.test(number) || !title) {
  console.error('Usage: npm run new -- <number> "<title>"\n  e.g. npm run new -- 2.4 "Garbage collection"');
  process.exit(1);
}
const existing = discoverSections().find((s) => s.number === number);
if (existing) {
  console.error(`Section ${number} already exists: ${path.relative(process.cwd(), existing.source)}`);
  process.exit(1);
}

const dir = path.join(SECTIONS_DIR, `ch${number}_${title.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_')}`);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(
  path.join(dir, 'index.tsx'),
  `import { useState } from 'react';
import { Slide, Card, Button } from '@framework';

export default function Page() {
  const [count, setCount] = useState(0);
  return (
    <Slide lead="One sentence that tells the audience what this section is about.">
      <Card title="Interactive widget">
        <Button onClick={() => setCount((c) => c + 1)}>Clicked {count} times</Button>
      </Card>
    </Slide>
  );
}
`,
);
console.log(`Created ${path.relative(process.cwd(), dir)}/index.tsx`);

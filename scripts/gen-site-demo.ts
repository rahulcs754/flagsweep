// Copies the codemod fixtures into the site, so the demo shows real, tested output.
// Run: npx tsx scripts/gen-site-demo.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const DEMOS = [
  { id: 'if-else', title: 'if / else' },
  { id: 'ternary', title: 'Ternary' },
  { id: 'jsx-and', title: 'JSX &&' },
  { id: 'early-return', title: 'Early return' },
  { id: 'variable', title: 'const variable' },
] as const;

const root = join(import.meta.dirname, '..');

export function buildDemo() {
  const read = (id: string, f: string) => readFileSync(join(root, 'test', 'fixtures', id, f), 'utf8');
  return DEMOS.map((d) => ({ ...d, input: read(d.id, 'input.tsx'), on: read(d.id, 'expected.on.tsx'), off: read(d.id, 'expected.off.tsx') }));
}

if (process.argv[1] === import.meta.filename) {
  writeFileSync(join(root, 'site', 'app', 'demo.json'), `${JSON.stringify(buildDemo(), null, 2)}\n`);
}

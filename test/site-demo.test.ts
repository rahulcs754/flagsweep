import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { buildDemo } from '../scripts/gen-site-demo.js';

it('site demo matches the tested fixtures (run scripts/gen-site-demo.ts)', () => {
  const site = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'site', 'app', 'demo.json'), 'utf8'));
  expect(site).toEqual(buildDemo());
});

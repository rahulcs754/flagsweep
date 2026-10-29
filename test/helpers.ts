import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Project, ts } from 'ts-morph';
import { removeFlagFromFile } from '../src/codemod.js';
import type { FlagState } from '../src/types.js';

export const FIXTURES = join(import.meta.dirname, 'fixtures');
export const READERS = ['useFeatureFlagEnabled', 'isFeatureEnabled', 'useFlag'];

export function fixture(name: string, file: string): string {
  return readFileSync(join(FIXTURES, name, file), 'utf8');
}

/** Run the codemod on source text in memory. */
export function run(source: string, state: FlagState, key = 'new-checkout') {
  const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { jsx: ts.JsxEmit.Preserve } });
  const sf = project.createSourceFile('/app/file.tsx', source);
  const result = removeFlagFromFile(sf, key, state, READERS);
  return { ...result, text: sf.getFullText() };
}

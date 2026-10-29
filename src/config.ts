import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Config, StaleFlag } from './types.js';

export const DEFAULT_CONFIG: Config = {
  provider: 'none',
  staleDays: 60,
  wrappers: [],
  include: ['**/*.{ts,tsx,js,jsx}'],
  exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/build/**', '**/coverage/**'],
  verify: {},
  flags: [],
};

export function loadConfig(cwd: string, file = 'flagsweep.json'): Config {
  const path = join(cwd, file);
  if (!existsSync(path)) return { ...DEFAULT_CONFIG };
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<Config>;
  const flags = (raw.flags ?? []).map((f): StaleFlag => {
    if (!f.key || (f.state !== 'on' && f.state !== 'off')) {
      throw new Error(`${file}: each flag needs "key" and "state" ("on" or "off")`);
    }
    return { key: f.key, state: f.state, since: f.since ?? '', source: 'config' };
  });
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    exclude: [...DEFAULT_CONFIG.exclude, ...(raw.exclude ?? [])],
    verify: { ...raw.verify },
    flags,
  };
}

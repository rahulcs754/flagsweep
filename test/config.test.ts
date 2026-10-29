import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, loadConfig } from '../src/config.js';
import { parseRemote, branchName } from '../src/git.js';

describe('config', () => {
  it('uses defaults without a file', () => {
    expect(loadConfig(mkdtempSync(join(tmpdir(), 'fs-')))).toEqual(DEFAULT_CONFIG);
  });

  it('merges a file and checks flags', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fs-'));
    writeFileSync(join(dir, 'flagsweep.json'), JSON.stringify({ wrappers: ['useFlag'], exclude: ['legacy/**'], flags: [{ key: 'a', state: 'on' }] }));
    const c = loadConfig(dir);
    expect(c.wrappers).toEqual(['useFlag']);
    expect(c.exclude).toContain('legacy/**');
    expect(c.exclude).toContain('**/node_modules/**');
    expect(c.flags).toEqual([{ key: 'a', state: 'on', since: '', source: 'config' }]);
    writeFileSync(join(dir, 'flagsweep.json'), JSON.stringify({ flags: [{ key: 'a', state: 'maybe' }] }));
    expect(() => loadConfig(dir)).toThrow(/"on" or "off"/);
  });
});

describe('git helpers', () => {
  it('parses remotes and branch names', () => {
    expect(parseRemote('git@github.com:acme/web.git')).toEqual({ owner: 'acme', repo: 'web' });
    expect(parseRemote('https://github.com/acme/web')).toEqual({ owner: 'acme', repo: 'web' });
    expect(parseRemote('https://gitlab.com/acme/web')).toBeUndefined();
    expect(branchName('Checkout V2!')).toBe('flagsweep/remove-Checkout-V2-');
  });
});

import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const DEMO = join(ROOT, 'examples', 'demo-app');

function cli(cwd: string, ...args: string[]) {
  const r = spawnSync(process.execPath, ['--import', 'tsx', join(ROOT, 'src', 'cli.ts'), '-C', cwd, ...args], {
    encoding: 'utf8',
    env: { ...process.env, GITHUB_TOKEN: '' },
  });
  return { code: r.status, out: r.stdout + r.stderr };
}

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

let repo: string;
beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'flagsweep-'));
  cpSync(DEMO, repo, { recursive: true });
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '-A');
  git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init');
});

describe('cli', () => {
  it('scan lists stale flags and uses', () => {
    const { code, out } = cli(repo, 'scan');
    expect(code).toBe(0);
    expect(out).toMatch(/new-checkout\s+on\s+2026-06-01\s+1\s+1/);
    expect(out).toMatch(/old-banner\s+off/);
    expect(out).toContain('src/App.tsx:5');
  });

  it('remove --dry-run writes nothing', () => {
    const before = readFileSync(join(repo, 'src/App.tsx'), 'utf8');
    const { out } = cli(repo, 'remove', 'new-checkout', '--dry-run');
    expect(out).toContain('1 file(s) changed');
    expect(readFileSync(join(repo, 'src/App.tsx'), 'utf8')).toBe(before);
  });

  it('remove uses the state from flagsweep.json', () => {
    cli(repo, 'remove', 'new-checkout');
    cli(repo, 'remove', 'old-banner');
    const app = readFileSync(join(repo, 'src/App.tsx'), 'utf8');
    expect(app).toContain('<NewCheckout />');
    expect(app).not.toMatch(/useFlag|OldCheckout|Banner/);
  });

  it('pr --dry-run commits one branch per flag and returns to main', () => {
    git(repo, 'config', 'user.name', 't');
    git(repo, 'config', 'user.email', 't@t');
    const { code, out } = cli(repo, 'pr', '--all', '--dry-run');
    expect(code).toBe(0);
    expect(out).toContain('new-checkout: committed on flagsweep/remove-new-checkout');
    expect(git(repo, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
    expect(git(repo, 'branch', '--list', 'flagsweep/*')).toContain('flagsweep/remove-old-banner');
    expect(git(repo, 'show', 'flagsweep/remove-new-checkout:src/App.tsx')).not.toContain('OldCheckout');
  });

  it('pr does not commit when verify fails', () => {
    const cfg = JSON.parse(readFileSync(join(repo, 'flagsweep.json'), 'utf8'));
    cfg.verify = { test: 'echo "1 test failed" && exit 1' };
    writeFileSync(join(repo, 'flagsweep.json'), JSON.stringify(cfg));
    git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qam', 'verify');
    const { code, out } = cli(repo, 'pr', 'new-checkout', '--dry-run');
    expect(code).toBe(1);
    expect(out).toContain('1 test failed');
    expect(git(repo, 'branch', '--list', 'flagsweep/*')).toBe('');
    expect(git(repo, 'status', '--porcelain')).toBe('');
  });

  it('pr refuses a dirty tree', () => {
    writeFileSync(join(repo, 'src/App.tsx'), '// edited\n');
    expect(cli(repo, 'pr', '--all', '--dry-run').out).toMatch(/Working tree has changes/);
  });
});

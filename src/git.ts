import { execFileSync } from 'node:child_process';

export function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export function isClean(cwd: string): boolean {
  return git(cwd, 'status', '--porcelain') === '';
}

export function currentBranch(cwd: string): string {
  return git(cwd, 'rev-parse', '--abbrev-ref', 'HEAD');
}

/** owner/repo from the origin URL (https or ssh). */
export function parseRemote(url: string): { owner: string; repo: string } | undefined {
  const m = /github\.com[:/]([^/]+)\/(.+?)(?:\.git)?\/?$/.exec(url.trim());
  return m ? { owner: m[1]!, repo: m[2]! } : undefined;
}

export function branchName(key: string): string {
  return `flagsweep/remove-${key.replace(/[^A-Za-z0-9._-]+/g, '-')}`;
}

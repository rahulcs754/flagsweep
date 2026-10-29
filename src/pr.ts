import { Octokit } from '@octokit/rest';
import type { FormatMode } from './format.js';
import { branchName, currentBranch, git, isClean, parseRemote } from './git.js';
import { prBody } from './report.js';
import { openProject, readersFor, removeFlag } from './sweep.js';
import { verify } from './verify.js';
import type { Config, StaleFlag } from './types.js';

export interface PrOptions {
  dryRun: boolean;
  verify: boolean;
  format: FormatMode;
}

export interface PrResult {
  key: string;
  status: 'opened' | 'committed' | 'nothing' | 'failed';
  message: string;
}

/** One branch, commit and PR per flag. The repo is put back on the starting branch after each flag. */
export async function openPrs(cwd: string, config: Config, flags: StaleFlag[], opts: PrOptions): Promise<PrResult[]> {
  if (!isClean(cwd)) throw new Error('Working tree has changes. Commit or stash them first.');
  const base = currentBranch(cwd);
  const token = process.env.GITHUB_TOKEN;
  const remote = originRemote(cwd);
  if (!opts.dryRun && (!token || !remote)) {
    throw new Error('Opening PRs needs GITHUB_TOKEN and a github.com "origin" remote. Use --dry-run to only commit.');
  }
  const octokit = token ? new Octokit({ auth: token }) : undefined;

  const results: PrResult[] = [];
  for (const flag of flags) {
    const branch = branchName(flag.key);
    git(cwd, 'checkout', '-q', '-B', branch, base);
    try {
      const project = openProject(cwd, config);
      const r = await removeFlag(project, cwd, flag.key, flag.state, readersFor(config), { write: true, format: opts.format });
      if (r.changed.length === 0) {
        const why = r.skipped.length ? `all ${r.skipped.length} use(s) need a manual change` : 'not used in code';
        results.push({ key: flag.key, status: 'nothing', message: `no PR, ${why}` });
        continue;
      }
      const passed: string[] = [];
      if (opts.verify) {
        const v = verify(cwd, config);
        if (!v.ok) {
          results.push({ key: flag.key, status: 'failed', message: `no PR, \`${v.failed!.command}\` failed:\n${v.failed!.output}` });
          continue;
        }
        passed.push(...[config.verify.typecheck, config.verify.test].filter((c): c is string => !!c));
      }
      git(cwd, 'add', '--', ...r.changed.map((c) => c.file));
      git(cwd, 'commit', '-q', '-m', `chore: remove stale feature flag ${flag.key}`);
      if (opts.dryRun || !octokit || !remote) {
        results.push({ key: flag.key, status: 'committed', message: `committed on ${branch} (dry run)` });
        continue;
      }
      git(cwd, 'push', '-q', '-u', 'origin', branch, '--force-with-lease');
      const pr = await octokit.pulls.create({
        ...remote,
        head: branch,
        base,
        title: `Remove stale feature flag \`${flag.key}\``,
        body: prBody(flag, r, passed),
      });
      results.push({ key: flag.key, status: 'opened', message: pr.data.html_url });
    } catch (err) {
      results.push({ key: flag.key, status: 'failed', message: (err as Error).message });
    } finally {
      // Drop anything left uncommitted and go back to where we started.
      git(cwd, 'reset', '-q', '--hard');
      git(cwd, 'checkout', '-q', base);
      if (results.at(-1)?.status !== 'opened' && results.at(-1)?.status !== 'committed') {
        git(cwd, 'branch', '-q', '-D', branch);
      }
    }
  }
  return results;
}

function originRemote(cwd: string) {
  try {
    return parseRemote(git(cwd, 'remote', 'get-url', 'origin'));
  } catch {
    return undefined;
  }
}

import { Command, Option } from 'commander';
import { loadConfig } from './config.js';
import type { FormatMode } from './format.js';
import { openPrs } from './pr.js';
import { loadStaleFlags } from './providers/index.js';
import { removeSummary, scanTable, usageList } from './report.js';
import { openProject, readersFor, removeFlag } from './sweep.js';
import { findUsages } from './usage.js';
import type { FlagState } from './types.js';

const program = new Command()
  .name('flagsweep')
  .description('Find stale feature flags and remove them from React/TypeScript code.')
  .version('0.1.0')
  .option('-C, --cwd <dir>', 'repo to work in', process.cwd())
  .option('-c, --config <file>', 'config file', 'flagsweep.json');

program
  .command('scan')
  .description('list stale flags and where the code reads them')
  .option('--json', 'print JSON')
  .action(async (opts: { json?: boolean }) => {
    const { cwd, config } = setup();
    const flags = await loadStaleFlags(config);
    const project = openProject(cwd, config);
    const all = findUsages(project.getSourceFiles(), readersFor(config), cwd);
    const stale = all.filter((u) => flags.some((f) => f.key === u.key));
    if (opts.json) return print(JSON.stringify({ flags, usages: stale }, null, 2));
    print(scanTable(flags, stale));
    if (stale.length) print(`\n${usageList(stale)}`);
    const other = [...new Set(all.map((u) => u.key))].filter((k) => !flags.some((f) => f.key === k));
    if (other.length) print(`\nOther flags read in code (not stale): ${other.join(', ')}`);
  });

program
  .command('remove <key>')
  .description('remove one flag from the code, keeping the on or off branch')
  .option('--on', 'the flag is always on: keep the "on" code')
  .option('--off', 'the flag is always off: keep the "off" code')
  .option('--dry-run', 'show what would change without writing files')
  .addOption(new Option('--format <mode>', 'run Prettier on changed files').choices(['auto', 'always', 'never']).default('auto'))
  .action(async (key: string, opts: { on?: boolean; off?: boolean; dryRun?: boolean; format: FormatMode }) => {
    const { cwd, config } = setup();
    let state: FlagState | undefined = opts.on ? 'on' : opts.off ? 'off' : undefined;
    if (opts.on && opts.off) fail('Pick one: --on or --off');
    if (!state) state = (await loadStaleFlags(config)).find((f) => f.key === key)?.state;
    if (!state) fail(`Don't know if "${key}" is on or off. Pass --on or --off.`);
    const project = openProject(cwd, config);
    const result = await removeFlag(project, cwd, key, state, readersFor(config), { write: !opts.dryRun, format: opts.format });
    print(removeSummary(result));
    if (opts.dryRun && result.changed.length) print('\n(dry run: no files written)');
  });

program
  .command('pr [keys...]')
  .description('open one PR per stale flag (needs GITHUB_TOKEN)')
  .option('--all', 'every stale flag')
  .option('--dry-run', 'create branches and commits locally, do not push or open PRs')
  .option('--no-verify', 'skip the typecheck and test commands')
  .addOption(new Option('--format <mode>', 'run Prettier on changed files').choices(['auto', 'always', 'never']).default('auto'))
  .action(async (keys: string[], opts: { all?: boolean; dryRun?: boolean; verify: boolean; format: FormatMode }) => {
    const { cwd, config } = setup();
    const stale = await loadStaleFlags(config);
    const picked = opts.all ? stale : stale.filter((f) => keys.includes(f.key));
    const unknown = keys.filter((k) => !stale.some((f) => f.key === k));
    if (unknown.length) fail(`Not in the stale list: ${unknown.join(', ')}. Add them to "flags" in flagsweep.json.`);
    if (picked.length === 0) fail('No flags picked. Pass flag keys or --all.');
    const results = await openPrs(cwd, config, picked, { dryRun: !!opts.dryRun, verify: opts.verify, format: opts.format });
    for (const r of results) print(`${r.key}: ${r.message}`);
    if (results.some((r) => r.status === 'failed')) process.exitCode = 1;
  });

function setup() {
  const { cwd, config: file } = program.opts<{ cwd: string; config: string }>();
  return { cwd, config: loadConfig(cwd, file) };
}

function print(text: string) {
  process.stdout.write(`${text}\n`);
}

function fail(message: string): never {
  process.stderr.write(`flagsweep: ${message}\n`);
  process.exit(1);
}

program.parseAsync().catch((err: Error) => fail(err.message));

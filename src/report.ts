import type { RemoveResult, StaleFlag, Usage } from './types.js';

export function scanTable(flags: StaleFlag[], usages: Usage[]): string {
  if (flags.length === 0) return 'No stale flags. Add some to "flags" in flagsweep.json or set "provider": "posthog".';
  const rows = flags.map((f) => {
    const uses = usages.filter((u) => u.key === f.key);
    const files = new Set(uses.map((u) => u.file)).size;
    return [f.key, f.state, f.since || '-', String(uses.length), String(files)];
  });
  return table(['flag', 'state', 'since', 'uses', 'files'], rows);
}

export function usageList(usages: Usage[]): string {
  return usages.map((u) => `  ${u.file}:${u.line}  ${u.key}  ${u.code}`).join('\n');
}

export function removeSummary(r: RemoveResult): string {
  const lines = [`${r.key} (${r.state}): ${r.changed.length} file(s) changed, ${r.skipped.length} skipped`];
  for (const c of r.changed) lines.push(`  changed  ${c.file}`);
  for (const s of r.skipped) lines.push(`  skipped  ${s.file}:${s.line}  ${s.reason}`);
  return lines.join('\n');
}

export function prBody(flag: StaleFlag, r: RemoveResult, verified: string[]): string {
  const kept = flag.state === 'on' ? 'the "on" code path' : 'the "off" code path';
  const lines = [
    `Removes the stale feature flag \`${flag.key}\`. It has been fully **${flag.state}**${flag.since ? ` since ${flag.since}` : ''}, so this PR keeps ${kept} and deletes the rest.`,
    '',
    '### Files changed',
    ...r.changed.map((c) => `- \`${c.file}\``),
  ];
  if (r.skipped.length) {
    lines.push('', '### Needs a manual look', 'FlagSweep did not change these, because the flag is used in a way it cannot safely rewrite:');
    lines.push(...r.skipped.map((s) => `- \`${s.file}:${s.line}\`: ${s.reason}`));
  }
  lines.push('', '### Checks', verified.length ? verified.map((c) => `- \`${c}\` passed`).join('\n') : '- No verify commands set in flagsweep.json');
  lines.push('', `After merging, delete \`${flag.key}\` in your flag provider.`, '', '_Opened by [FlagSweep](https://github.com/rahulcs754/flagsweep)._');
  return lines.join('\n');
}

function table(head: string[], rows: string[][]): string {
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]!.length)));
  const fmt = (r: string[]) => r.map((c, i) => c.padEnd(widths[i]!)).join('  ').trimEnd();
  return [fmt(head), fmt(widths.map((w) => '-'.repeat(w))), ...rows.map(fmt)].join('\n');
}

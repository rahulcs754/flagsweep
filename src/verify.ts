import { spawnSync } from 'node:child_process';
import type { Config } from './types.js';

export interface VerifyResult {
  ok: boolean;
  failed?: { command: string; output: string };
}

/** Run the repo's typecheck and test commands. Stops at the first failure. */
export function verify(cwd: string, config: Config): VerifyResult {
  for (const command of [config.verify.typecheck, config.verify.test]) {
    if (!command) continue;
    const r = spawnSync(command, { cwd, shell: true, encoding: 'utf8', env: { ...process.env, CI: '1' } });
    if (r.status !== 0) {
      const output = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-40).join('\n');
      return { ok: false, failed: { command, output } };
    }
  }
  return { ok: true };
}

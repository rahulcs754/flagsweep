import type { Config, StaleFlag } from '../types.js';
import { fetchPostHogFlags, staleFromPostHog } from './posthog.js';

/** Stale flags from the provider plus the manual list in flagsweep.json. The manual list wins on conflicts. */
export async function loadStaleFlags(config: Config, fetchFn?: typeof fetch): Promise<StaleFlag[]> {
  const byKey = new Map<string, StaleFlag>();
  if (config.provider === 'posthog') {
    const flags = await fetchPostHogFlags({ ...config.posthog, fetchFn });
    for (const f of staleFromPostHog(flags, config.staleDays)) byKey.set(f.key, f);
  }
  for (const f of config.flags) byKey.set(f.key, f);
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

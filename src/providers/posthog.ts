import type { StaleFlag } from '../types.js';

/** The parts of a PostHog feature flag we read. */
export interface PostHogFlag {
  key: string;
  active: boolean;
  deleted?: boolean;
  created_at?: string;
  updated_at?: string | null;
  filters?: {
    groups?: { properties?: unknown[]; rollout_percentage?: number | null; variant?: string | null }[];
    multivariate?: unknown;
  };
}

/**
 * Decide if a PostHog flag is stuck fully on or fully off.
 * Returns undefined when the flag still targets users (properties, partial rollout, variants).
 */
export function posthogState(flag: PostHogFlag): 'on' | 'off' | undefined {
  if (flag.deleted) return undefined;
  if (!flag.active) return 'off';
  if (flag.filters?.multivariate) return undefined;
  const groups = flag.filters?.groups ?? [];
  if (groups.length === 0) return undefined;
  const plain = groups.every((g) => (g.properties ?? []).length === 0);
  if (!plain) return undefined;
  const rollouts = groups.map((g) => g.rollout_percentage ?? 100);
  if (rollouts.some((r) => r === 100)) return 'on';
  if (rollouts.every((r) => r === 0)) return 'off';
  return undefined;
}

export function staleFromPostHog(flags: PostHogFlag[], staleDays: number, now = new Date()): StaleFlag[] {
  const cutoff = now.getTime() - staleDays * 86_400_000;
  const out: StaleFlag[] = [];
  for (const flag of flags) {
    const state = posthogState(flag);
    const since = flag.updated_at ?? flag.created_at;
    if (!state || !since) continue;
    if (new Date(since).getTime() > cutoff) continue;
    out.push({ key: flag.key, state, since: since.slice(0, 10), source: 'posthog' });
  }
  return out;
}

/** Fetch all flags of a project. Needs POSTHOG_API_KEY (personal API key) and a project id. */
export async function fetchPostHogFlags(opts: {
  host?: string;
  projectId?: string;
  apiKey?: string;
  fetchFn?: typeof fetch;
}): Promise<PostHogFlag[]> {
  const host = (opts.host ?? process.env.POSTHOG_HOST ?? 'https://us.posthog.com').replace(/\/$/, '');
  const projectId = opts.projectId ?? process.env.POSTHOG_PROJECT_ID;
  const apiKey = opts.apiKey ?? process.env.POSTHOG_API_KEY;
  if (!apiKey || !projectId) {
    throw new Error('PostHog needs POSTHOG_API_KEY and POSTHOG_PROJECT_ID (or posthog.projectId in flagsweep.json)');
  }
  const doFetch = opts.fetchFn ?? fetch;
  const flags: PostHogFlag[] = [];
  let url: string | null = `${host}/api/projects/${projectId}/feature_flags/?limit=100`;
  while (url) {
    const res = await doFetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) throw new Error(`PostHog API error ${res.status} for ${new URL(url).pathname}`);
    const body = (await res.json()) as { results: PostHogFlag[]; next: string | null };
    flags.push(...body.results);
    url = body.next;
  }
  return flags;
}

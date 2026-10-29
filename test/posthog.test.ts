import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fetchPostHogFlags, posthogState, staleFromPostHog, type PostHogFlag } from '../src/providers/posthog.js';
import { FIXTURES } from './helpers.js';

const recorded = JSON.parse(readFileSync(join(FIXTURES, '..', 'recorded', 'posthog-flags.json'), 'utf8')) as { results: PostHogFlag[] };
const now = new Date('2026-10-29T00:00:00Z');

describe('posthog', () => {
  it('reads state from rollout and targeting', () => {
    const byKey = Object.fromEntries(recorded.results.map((f) => [f.key, posthogState(f)]));
    expect(byKey).toEqual({
      'new-checkout': 'on',
      'old-banner': 'off',
      'zero-rollout': 'off',
      'beta-users': undefined,
      'half-rollout': undefined,
      'ab-test': undefined,
      'fresh-flag': 'on',
    });
  });

  it('only returns flags unchanged for staleDays', () => {
    const keys = staleFromPostHog(recorded.results, 60, now).map((f) => f.key);
    expect(keys).toEqual(['new-checkout', 'old-banner', 'zero-rollout']);
  });

  it('follows pagination and sends the key only in the header', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      const page2 = url.includes('offset=1');
      return new Response(
        JSON.stringify({
          results: page2 ? recorded.results.slice(1) : recorded.results.slice(0, 1),
          next: page2 ? null : 'https://eu.posthog.com/api/projects/7/feature_flags/?limit=100&offset=1',
        }),
      );
    });
    const flags = await fetchPostHogFlags({ host: 'https://eu.posthog.com/', projectId: '7', apiKey: 'phx_test', fetchFn: fetchFn as unknown as typeof fetch });
    expect(flags).toHaveLength(recorded.results.length);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://eu.posthog.com/api/projects/7/feature_flags/?limit=100');
    expect(url).not.toContain('phx_test');
    expect(init.headers).toEqual({ Authorization: 'Bearer phx_test' });
  });

  it('errors without a key', async () => {
    await expect(fetchPostHogFlags({ projectId: '7', apiKey: '' })).rejects.toThrow(/POSTHOG_API_KEY/);
  });
});

# FlagSweep: MVP plan

**One line:** A TypeScript CLI that finds feature flags stuck at 100% (or 0%) for 60+ days and opens a PR that removes the flag check and the dead code.

## How it works
1. **Flag status:** get each flag's state and last-changed date. MVP sources:
   - PostHog API (`/api/projects/:id/feature_flags`, needs `POSTHOG_API_KEY`)
   - `flagsweep.json` file for any other provider or manual lists
   A flag is **stale** when it is fully on or fully off, with no targeting, and unchanged for `staleDays` (default 60).
2. **Find usage:** ts-morph scans `.ts/.tsx` for flag reads by key:
   - PostHog: `useFeatureFlagEnabled('key')`, `posthog.isFeatureEnabled('key')`
   - Custom wrappers from config, e.g. `isEnabled('key')`, `useFlag('key')`
   - Follows one level of `const x = useFlag('key')`.
3. **Codemod:** replace the flag read with `true` or `false`, then simplify (see patterns). Remove unused imports and variables.
4. **Verify:** run `typecheck` and `test` commands from config. Fail = no PR, show the error.
5. **PR:** one branch + PR per flag (`flagsweep/remove-<key>`), body lists files changed, kept branch, and skipped usages.

## Codemod patterns (MVP)
| Pattern | Example | Result when ON |
|---|---|---|
| if / else | `if (on) { A } else { B }` | `A` |
| Ternary | `on ? <New/> : <Old/>` | `<New/>` |
| JSX and | `{on && <Banner/>}` | `<Banner/>` (removed when OFF) |
| Early return | `if (!on) return null;` | line removed (rest of function removed when OFF) |

Not supported (reported, not changed): flag passed as a prop, used in `useEffect` deps, stored in state, or combined like `on && other` beyond simple cases.

## Config `flagsweep.json`
```json
{
  "provider": "posthog",
  "staleDays": 60,
  "wrappers": ["useFlag", "isEnabled"],
  "include": ["src/**/*.{ts,tsx}"],
  "verify": { "typecheck": "npm run typecheck", "test": "npm test" },
  "flags": [{ "key": "old-banner", "state": "off", "since": "2026-06-01" }]
}
```

## Stack
TypeScript (Node 22, ESM), ts-morph, commander, prettier, vitest. GitHub API via `@octokit/rest` for PRs. No AI in the MVP. Optional later: Claude handles the unsupported patterns and writes the PR summary.

## Build order (2-3 weeks)
1. CLI skeleton + config + `scan` (find usages, print table)
2. Codemods for the 4 patterns, with fixture tests for on and off
3. Cleanup pass: unused imports, unused variables, empty fragments
4. PostHog provider with recorded API fixtures
5. Verify step + `pr` command (branch, commit, PR via Octokit)
6. Demo: a sample Next.js app with 5 stale flags, before/after GIF for the README

## Later
- Providers: LaunchDarkly, GrowthBook, Unleash, Vercel Flags
- GitHub Action that runs weekly and opens PRs
- Notify flag owners before removal (Delivery Hero style nudge)

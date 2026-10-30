# FlagSweep

Removes **stale feature flags** from React and TypeScript code. It finds flags that have been fully rolled out (or turned off) for 60+ days and opens a PR that deletes the flag check and the dead branch.

> Status: v0.1 MVP.

## Why
- Old flags pile up: dead branches, confusing code, and risky "what does this flag do?" moments.
- Uber built Piranha and Delivery Hero built an AI cleanup bot (Aug 2026) just for this.
- Vendor tools (LaunchDarkly, PostHog, Amplitude) only clean up their own flags. FlagSweep is vendor-neutral.

## What it does
- Reads flag status from PostHog, or from a `flagsweep.json` list for any provider
- Finds flag reads in code: `useFeatureFlagEnabled('key')`, `posthog.isFeatureEnabled('key')`, and your own wrappers like `useFlag('key')`
- Follows `const x = useFlag('key')` to every place `x` is used
- Rewrites 4 patterns: `if / else`, ternaries, JSX `flag && <X/>`, and early returns (code after the return goes too when it becomes dead)
- Also folds `!flag`, `flag || x` and `flag ?? x`
- Removes imports and local helpers that only the deleted code used
- Runs your typecheck and tests, then opens one PR per flag

**Safe by default:** if a file uses the flag in a way FlagSweep can't rewrite (passed as a prop, in hook deps, stored in `let`, returned), the whole file is left untouched and listed under "needs a manual look". It never touches `true`/`false` you wrote yourself.

## Example
```tsx
// before (flag "new-checkout" is fully on)
const newCheckout = useFlag('new-checkout');
return (
  <main>
    {useFlag('old-banner') && <Banner />}
    {newCheckout ? <NewCheckout /> : <OldCheckout />}
  </main>
);

// after `flagsweep pr --all`
return (
  <main>
    <NewCheckout />
  </main>
);
```

## Usage
```bash
npx flagsweep scan                       # stale flags and where they are used
npx flagsweep remove new-checkout --on   # keep the "on" code
npx flagsweep remove old-banner --off    # keep the "off" code
npx flagsweep remove old-banner --dry-run
npx flagsweep pr --all                   # one branch + PR per stale flag
npx flagsweep pr new-checkout --dry-run  # commit locally, no push
```

`pr` needs a clean working tree, `GITHUB_TOKEN`, and a github.com `origin`. If typecheck or tests fail, no PR is opened and the error is shown.

## Config: `flagsweep.json`
```json
{
  "provider": "posthog",
  "staleDays": 60,
  "posthog": { "host": "https://eu.posthog.com", "projectId": "12345" },
  "wrappers": ["useFlag", "isEnabled"],
  "include": ["src/**/*.{ts,tsx}"],
  "verify": { "typecheck": "npm run typecheck", "test": "npm test" },
  "flags": [{ "key": "old-banner", "state": "off", "since": "2026-06-01" }]
}
```
- `provider`: `"posthog"` or `"none"`. PostHog needs `POSTHOG_API_KEY` (personal API key) in the environment. Keys are only read from env.
- A PostHog flag is stale when it is off, or on at 100% with no targeting and no variants, and unchanged for `staleDays`.
- `flags`: manual list for any provider (LaunchDarkly, GrowthBook, your own). It wins over the provider.
- Prettier runs on changed files only when the repo has a Prettier config (`--format always|never` to change).

Try it on the demo: `cd examples/demo-app && npx tsx ../../src/cli.ts scan`.

## Develop
```bash
npm install
npm test          # vitest: fixture tests for every pattern, --on and --off
npm run typecheck
npm run build
```

## Not yet
- More providers (LaunchDarkly, GrowthBook, Unleash, Vercel Flags)
- Weekly GitHub Action
- Claude for the patterns we skip today

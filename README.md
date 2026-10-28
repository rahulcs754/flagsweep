# FlagSweep

Removes **stale feature flags** from React and TypeScript code. It finds flags that have been fully rolled out (or turned off) for 60+ days and opens a PR that deletes the flag check and the dead branch.

> Status: planning. See [docs/MVP-PLAN.md](docs/MVP-PLAN.md).

## Why
- Old flags pile up: dead branches, confusing code, and risky "what does this flag do?" moments.
- Uber built Piranha and Delivery Hero built an AI cleanup bot (Aug 2026) just for this.
- Vendor tools (LaunchDarkly, PostHog, Amplitude) only clean up their own flags. FlagSweep is vendor-neutral.

## What it will do
- Read flag status from PostHog (first), or a local `flagsweep.json` for any provider
- Find flag usage in code: hooks, SDK calls and your own wrapper function
- Remove 4 patterns: `if (flag)`, ternaries, JSX `flag && <X/>`, and early returns
- Clean up unused imports and variables after the change
- Run typecheck and tests, then open one PR per flag

## Planned usage
```bash
npx flagsweep scan                       # list stale flags and where they are used
npx flagsweep remove new-checkout --on   # flag is always ON: keep the "on" branch
npx flagsweep remove old-banner --off    # flag is always OFF: keep the "off" branch
npx flagsweep pr --all                   # one PR per stale flag
```

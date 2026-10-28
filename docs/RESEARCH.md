# Research notes (Oct 2026)

- Uber built Piranha, an open-source tool to delete stale flag code, and wrote about AI code cleanup. Source: https://www.uber.com/us/en/blog/ai-code-cleanup/
- Delivery Hero (Aug 2026) built an AI bot for flag cleanup; nudges owners after 60 days. Source: https://deliveryhero.jobs/blog/from-stale-flags-to-clean-code-automating-feature-flag-governance-using-ai/
- Amplitude shipped stale-flag management in Feb 2026. Source: https://amplitude.com/releases/stale-flag-management
- DevOpsDays Prague 2026 had a talk on flag debt.

## Competitors
- Piranha: open-source, strong, but needs custom rules per language and setup.
- LaunchDarkly / PostHog AI cleanup skills: tied to one vendor.
- Amplitude: flags stale flags in the UI, does not change code.

**Gap:** a vendor-neutral, React/TS-first CLI that ships a ready, tested PR per flag.

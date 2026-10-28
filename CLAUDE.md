# CLAUDE.md

## Project
FlagSweep: a TypeScript CLI (+ GitHub Action later) that finds stale feature flags and removes them from React/TS code with ts-morph codemods, then opens a PR per flag. Plan: docs/MVP-PLAN.md. Research: docs/RESEARCH.md.

## Stack
Node 22, ESM, TypeScript strict. ts-morph, commander, vitest. Prettier to format changed files. No AI in the MVP.

## Rules
- Codemods must be safe: if a usage pattern is not one we support, skip it and report it. Never guess.
- Every codemod has fixture tests: `input.tsx` -> `expected.tsx`, for both `--on` and `--off`.
- Only touch files that use the flag. Keep the user's formatting (run Prettier only on changed files).
- After a change, run the repo's typecheck and tests. If they fail, do not open the PR; report why.
- Provider API keys come from env vars only. Never log them. Tests use recorded API responses, no network.

## Commands
- `npm test`, `npm run build`, `npm run dev -- scan`

## Owner
Senior React/Next.js dev, India. Wants short, simple English and a clean portfolio-grade repo.

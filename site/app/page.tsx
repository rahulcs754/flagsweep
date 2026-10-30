import { CopyCommand } from './CopyCommand';
import { Demo } from './Demo';

const REPO = 'https://github.com/rahulcs754/flagsweep';

const steps = [
  { n: '01', title: 'Find', body: 'Reads flag status from PostHog or a flagsweep.json list. A flag is stale when it is fully on or off and unchanged for 60 days.' },
  { n: '02', title: 'Rewrite', body: 'ts-morph codemods remove the flag check and keep the right branch: if / else, ternaries, JSX &&, early returns. Unused imports go too.' },
  { n: '03', title: 'Verify and open a PR', body: 'Runs your typecheck and tests. Only if they pass does it push a branch and open one PR per flag.' },
];

const safe = [
  'A file with a use it cannot rewrite (prop, hook deps, let, return value) is left untouched and listed for a manual look.',
  'It never changes a true or false that you wrote yourself.',
  'Code after an unconditional return is removed only when it is truly dead.',
  'API keys come from env vars only and are never logged.',
];

const config = `{
  "provider": "posthog",
  "staleDays": 60,
  "wrappers": ["useFlag"],
  "verify": {
    "typecheck": "npm run typecheck",
    "test": "npm test"
  },
  "flags": [{ "key": "old-banner", "state": "off" }]
}`;

export default function Home() {
  return (
    <main className="wrap">
      <header className="hero">
        <nav className="nav">
          <span className="logo">
            <span className="logo-mark" aria-hidden>⌫</span> FlagSweep
          </span>
          <a href={REPO}>GitHub</a>
        </nav>
        <p className="eyebrow">Open-source CLI · React + TypeScript</p>
        <h1>Delete stale feature flags, safely.</h1>
        <p className="lede">
          FlagSweep finds flags that have been fully on or off for weeks, removes the flag check and the dead branch, runs your
          tests, and opens one clean PR per flag.
        </p>
        <div className="cta">
          <CopyCommand command="npx flagsweep scan" />
          <a className="btn" href={REPO}>
            View on GitHub
          </a>
        </div>
      </header>

      <section aria-labelledby="demo-h">
        <h2 id="demo-h">See the PR it would open</h2>
        <Demo />
      </section>

      <section aria-labelledby="how-h">
        <h2 id="how-h">How it works</h2>
        <ol className="steps">
          {steps.map((s) => (
            <li key={s.n} className="step">
              <span className="step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="two" aria-labelledby="safe-h">
        <div>
          <h2 id="safe-h">Safe by default</h2>
          <ul className="checks">
            {safe.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2>flagsweep.json</h2>
          <pre className="code small">{config}</pre>
        </div>
      </section>

      <section aria-labelledby="cmd-h">
        <h2 id="cmd-h">Commands</h2>
        <pre className="code small">{`flagsweep scan                       # stale flags and where they are used
flagsweep remove new-checkout --on   # keep the "on" code
flagsweep remove old-banner --off    # keep the "off" code
flagsweep pr --all                   # one tested PR per stale flag`}</pre>
      </section>

      <footer className="foot">
        <span>FlagSweep v0.1 · MIT</span>
        <a href={REPO}>github.com/rahulcs754/flagsweep</a>
      </footer>
    </main>
  );
}

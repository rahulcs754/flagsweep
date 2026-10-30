'use client';

import { useMemo, useState } from 'react';
import demos from './demo.json';
import { lineDiff } from './diff';

type State = 'on' | 'off';

export function Demo() {
  const [id, setId] = useState(demos[0]!.id);
  const [state, setState] = useState<State>('on');
  const demo = demos.find((d) => d.id === id) ?? demos[0]!;
  const lines = useMemo(() => lineDiff(demo.input, demo[state]), [demo, state]);
  const removed = lines.filter((l) => l.kind === 'del').length;
  const added = lines.filter((l) => l.kind === 'add').length;

  return (
    <div className="demo">
      <div className="demo-bar">
        <div className="tabs" role="tablist" aria-label="Pattern">
          {demos.map((d) => (
            <button key={d.id} role="tab" aria-selected={d.id === id} className="tab" onClick={() => setId(d.id)}>
              {d.title}
            </button>
          ))}
        </div>
        <div className="toggle" role="radiogroup" aria-label="Flag state">
          {(['on', 'off'] as const).map((s) => (
            <button key={s} role="radio" aria-checked={state === s} className="toggle-btn" onClick={() => setState(s)}>
              flag {s}
            </button>
          ))}
        </div>
      </div>
      <div className="file-head">
        <span className="mono">src/{demo.id}.tsx</span>
        <span className="stat">
          <span className="del-count">−{removed}</span> <span className="add-count">+{added}</span>
        </span>
      </div>
      <pre className="code" aria-label={`Diff after removing new-checkout, flag ${state}`}>
        {lines.map((l, i) => (
          <div key={`${demo.id}-${state}-${i}`} className={`line ${l.kind}`}>
            <span className="sign" aria-hidden>
              {l.kind === 'del' ? '−' : l.kind === 'add' ? '+' : ' '}
            </span>
            <span>{l.text || ' '}</span>
          </div>
        ))}
      </pre>
      <p className="demo-note">
        Real output from the codemod test fixtures for the flag <code>new-checkout</code>. Nothing here is hand-edited.
      </p>
    </div>
  );
}

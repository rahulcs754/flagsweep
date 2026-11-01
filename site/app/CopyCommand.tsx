'use client';

import { useState } from 'react';

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="cmd"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(command);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked: nothing to do */
        }
      }}
      aria-label={`Copy ${command}`}
    >
      <span className="prompt">$</span> {command}
      <span className="copy">{copied ? 'copied' : 'copy'}</span>
    </button>
  );
}

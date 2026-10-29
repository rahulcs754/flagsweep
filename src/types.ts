export type FlagState = 'on' | 'off';

/** A flag that is fully rolled out (or fully off) and safe to remove. */
export interface StaleFlag {
  key: string;
  state: FlagState;
  /** ISO date the flag last changed. */
  since: string;
  source: 'posthog' | 'config';
}

export interface Config {
  provider: 'posthog' | 'none';
  staleDays: number;
  /** Extra function names that read a flag by key, e.g. `useFlag('key')`. */
  wrappers: string[];
  include: string[];
  exclude: string[];
  verify: { typecheck?: string; test?: string };
  flags: StaleFlag[];
  posthog?: { host?: string; projectId?: string };
}

export interface Usage {
  file: string;
  line: number;
  key: string;
  /** The function that reads the flag, e.g. `useFeatureFlagEnabled`. */
  reader: string;
  /** Code of the line, for reports. */
  code: string;
}

export interface Skipped {
  file: string;
  line: number;
  reason: string;
}

export interface FileChange {
  file: string;
  before: string;
  after: string;
}

export interface RemoveResult {
  key: string;
  state: FlagState;
  changed: FileChange[];
  skipped: Skipped[];
}

import { writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';
import { Project, ts } from 'ts-morph';
import { removeFlagFromFile } from './codemod.js';
import { formatFile, type FormatMode } from './format.js';
import { BUILTIN_READERS } from './usage.js';
import type { Config, FlagState, RemoveResult } from './types.js';

export function readersFor(config: Config): string[] {
  return [...new Set([...BUILTIN_READERS, ...config.wrappers])];
}

export function openProject(cwd: string, config: Config): Project {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: true, jsx: ts.JsxEmit.Preserve },
  });
  const abs = (p: string) => (isAbsolute(p) ? p : join(cwd, p));
  project.addSourceFilesAtPaths([...config.include.map(abs), ...config.exclude.map((p) => `!${abs(p)}`)]);
  return project;
}

export interface RemoveOptions {
  write: boolean;
  format: FormatMode;
}

/** Remove one flag from every file in the project. Files with unsupported uses are skipped, not changed. */
export async function removeFlag(
  project: Project,
  cwd: string,
  key: string,
  state: FlagState,
  readers: string[],
  opts: RemoveOptions,
): Promise<RemoveResult> {
  const result: RemoveResult = { key, state, changed: [], skipped: [] };
  for (const sf of project.getSourceFiles()) {
    const before = sf.getFullText();
    const r = removeFlagFromFile(sf, key, state, readers);
    const file = relative(cwd, sf.getFilePath());
    if (r.skipped) result.skipped.push({ file, ...r.skipped });
    if (!r.changed) continue;
    const after = await formatFile(sf.getFilePath(), sf.getFullText(), opts.format);
    result.changed.push({ file, before, after });
  }
  if (opts.write) {
    for (const c of result.changed) await writeFile(join(cwd, c.file), c.after);
  }
  return result;
}

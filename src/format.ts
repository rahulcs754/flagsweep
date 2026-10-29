import * as prettier from 'prettier';

/** auto: format only when the repo has a Prettier config, so we don't restyle repos that don't use it. */
export type FormatMode = 'auto' | 'always' | 'never';

export async function formatFile(path: string, text: string, mode: FormatMode): Promise<string> {
  if (mode === 'never') return text;
  const configFile = await prettier.resolveConfigFile(path);
  if (mode === 'auto' && !configFile) return text;
  const options = (await prettier.resolveConfig(path)) ?? {};
  try {
    return await prettier.format(text, { ...options, filepath: path });
  } catch {
    return text;
  }
}

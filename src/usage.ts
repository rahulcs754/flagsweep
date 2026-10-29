import { Node, SyntaxKind, type CallExpression, type SourceFile } from 'ts-morph';
import type { Usage } from './types.js';

/** Functions that read a boolean flag by key, out of the box. */
export const BUILTIN_READERS = [
  'useFeatureFlagEnabled', // posthog-js/react
  'isFeatureEnabled', // posthog.isFeatureEnabled('key')
];

/** Name of the function being called: `useFlag(...)` -> useFlag, `posthog.isFeatureEnabled(...)` -> isFeatureEnabled. */
export function calleeName(call: CallExpression): string | undefined {
  const callee = call.getExpression();
  if (Node.isIdentifier(callee)) return callee.getText();
  if (Node.isPropertyAccessExpression(callee)) return callee.getName();
  return undefined;
}

/** The flag key passed as the first argument, if it is a plain string. */
export function flagKeyOf(call: CallExpression): string | undefined {
  const arg = call.getArguments()[0];
  if (arg && (Node.isStringLiteral(arg) || Node.isNoSubstitutionTemplateLiteral(arg))) {
    return arg.getLiteralText();
  }
  return undefined;
}

export function findFlagCalls(sf: SourceFile, readers: string[], key?: string): CallExpression[] {
  return sf.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => {
    const name = calleeName(call);
    if (!name || !readers.includes(name)) return false;
    const k = flagKeyOf(call);
    return k !== undefined && (key === undefined || k === key);
  });
}

export function findUsages(files: SourceFile[], readers: string[], cwd: string, key?: string): Usage[] {
  const usages: Usage[] = [];
  for (const sf of files) {
    for (const call of findFlagCalls(sf, readers, key)) {
      const line = call.getStartLineNumber();
      usages.push({
        file: relative(cwd, sf.getFilePath()),
        line,
        key: flagKeyOf(call)!,
        reader: calleeName(call)!,
        code: sf.getFullText().split('\n')[line - 1]?.trim() ?? '',
      });
    }
  }
  return usages;
}

function relative(cwd: string, file: string): string {
  const base = cwd.endsWith('/') ? cwd : `${cwd}/`;
  return file.startsWith(base) ? file.slice(base.length) : file;
}

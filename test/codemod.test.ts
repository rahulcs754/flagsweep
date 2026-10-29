import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIXTURES, fixture, run } from './helpers.js';

const cases = readdirSync(FIXTURES).filter((d) => d !== 'unsupported');

describe('fixtures', () => {
  for (const dir of cases) {
    for (const state of ['on', 'off'] as const) {
      it(`${dir} --${state}`, () => {
        const r = run(fixture(dir, 'input.tsx'), state);
        expect(r.skipped).toBeUndefined();
        expect(r.changed).toBe(true);
        expect(r.text).toBe(fixture(dir, `expected.${state}.tsx`));
        expect(r.text).not.toMatch(/__FLAGSWEEP_/);
      });
    }
  }

  it('skips a file with an unsupported use and leaves it untouched', () => {
    const input = fixture('unsupported', 'input.tsx');
    for (const state of ['on', 'off'] as const) {
      const r = run(input, state);
      expect(r.changed).toBe(false);
      expect(r.text).toBe(input);
      expect(r.skipped).toEqual({ line: 5, reason: expect.stringContaining('function argument') });
    }
  });
});

describe('codemod rules', () => {
  const wrap = (body: string) => `import { useFlag } from './flags';\nexport function f(a: boolean) {\n${body}\n}\n`;

  it('leaves files without the flag alone', () => {
    const src = wrap("  if (useFlag('other')) return 1;\n  return 2;");
    expect(run(src, 'on')).toEqual({ changed: false, text: src });
  });

  it('never touches true/false the user wrote', () => {
    const r = run(wrap("  if (true && a) return 0;\n  return useFlag('new-checkout') ? 1 : 2;"), 'on');
    expect(r.text).toContain('if (true && a) return 0;');
    expect(r.text).toContain('return 1;');
  });

  it('handles ||, ?? and double negation', () => {
    expect(run(wrap("  return useFlag('new-checkout') || a;"), 'off').text).toContain('return a;');
    expect(run(wrap("  return useFlag('new-checkout') || a;"), 'on').skipped?.reason).toMatch(/return value/);
    const or = run(wrap("  if (useFlag('new-checkout') || a) { go(); }"), 'off');
    expect(or.text).toContain('if (a) {');
    const nn = run(wrap("  if (!!useFlag('new-checkout')) { go(); }"), 'on');
    expect(nn.text).toContain('  go();');
    expect(nn.text).not.toContain('if');
  });

  it('keeps braces when unwrapping would clash with an outer name', () => {
    const r = run(wrap("  const x = 1;\n  if (useFlag('new-checkout')) {\n    const x = 2;\n    console.log(x);\n  }\n  return x;"), 'on');
    expect(r.text).toContain('{\n    const x = 2;');
  });

  it('removes a missing else branch cleanly', () => {
    const r = run(wrap("  if (a) {\n    one();\n  } else if (useFlag('new-checkout')) {\n    two();\n  }"), 'off');
    expect(r.text).toContain('if (a) {\n    one();\n  }\n}');
  });

  it('skips let variables and props', () => {
    expect(run(wrap("  let on = useFlag('new-checkout');\n  return on;"), 'on').skipped?.reason).toMatch(/let\/var/);
    const prop = run(`import { useFlag } from './flags';\nexport const A = () => <B enabled={useFlag('new-checkout')} />;\n`, 'on');
    expect(prop.skipped?.reason).toMatch(/JSX prop/);
  });

  it('removes imports only the deleted code used, keeps the rest', () => {
    const src = [
      "import { useFlag, useOther } from './flags';",
      "import { Old } from './Old';",
      "import { Shared } from './Shared';",
      'export function A() {',
      "  useOther();",
      "  return useFlag('new-checkout') ? <Shared /> : <><Old /><Shared /></>;",
      '}',
      '',
    ].join('\n');
    const r = run(src, 'on');
    expect(r.text).toContain("import { useOther } from './flags';");
    expect(r.text).not.toContain('Old');
    expect(r.text).toContain("import { Shared } from './Shared';");
    expect(r.text).toContain('return <Shared />;');
  });
});

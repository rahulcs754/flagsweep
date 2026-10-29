import {
  Node,
  SyntaxKind,
  VariableDeclarationKind,
  type Block,
  type Expression,
  type IfStatement,
  type SourceFile,
  type Statement,
} from 'ts-morph';
import { findFlagCalls } from './usage.js';
import type { FlagState } from './types.js';

/**
 * How it works:
 * 1. Every flag read (and every use of `const x = useFlag('key')`) becomes a placeholder identifier.
 * 2. We simplify around one placeholder at a time (`!`, `&&`, `||`, ternary, `if`, JSX `{...}`),
 *    re-parsing after every edit, until no placeholder is left.
 * 3. If a placeholder lands somewhere we do not support, the whole file is put back as it was.
 * Placeholders mean we never touch `true`/`false` that the user wrote themselves.
 */
const ON = '__FLAGSWEEP_ON__';
const OFF = '__FLAGSWEEP_OFF__';
const MAX_STEPS = 5000;

export class Unsupported extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(message);
  }
}

export interface FileResult {
  changed: boolean;
  /** Set when the file uses the flag in a way we do not support. The file is left untouched. */
  skipped?: { line: number; reason: string };
}

export function removeFlagFromFile(sf: SourceFile, key: string, state: FlagState, readers: string[]): FileResult {
  const original = sf.getFullText();
  if (findFlagCalls(sf, readers, key).length === 0) return { changed: false };
  const firstLine = findFlagCalls(sf, readers, key)[0]!.getStartLineNumber();
  const namesBefore = identifierCounts(sf);
  try {
    bindPlaceholders(sf, key, state, readers);
    simplify(sf);
    removeNewlyUnused(sf, namesBefore);
  } catch (err) {
    sf.replaceWithText(original);
    // Lines move while we edit, so point at the first flag read in the original file.
    if (err instanceof Unsupported) return { changed: false, skipped: { line: firstLine, reason: err.message } };
    throw err;
  }
  return { changed: sf.getFullText() !== original };
}

const PLACES: Partial<Record<SyntaxKind, string>> = {
  [SyntaxKind.CallExpression]: 'a function argument',
  [SyntaxKind.ArrayLiteralExpression]: 'an array item (for example hook deps)',
  [SyntaxKind.ReturnStatement]: 'a return value',
  [SyntaxKind.PropertyAssignment]: 'an object value',
  [SyntaxKind.VariableDeclaration]: 'a variable value',
  [SyntaxKind.JsxExpression]: 'a JSX prop',
  [SyntaxKind.ArrowFunction]: 'an arrow function result',
  [SyntaxKind.BinaryExpression]: 'part of a bigger expression',
};

function describe(node: Node): string {
  return PLACES[node.getKind()] ?? `a ${node.getKindName()}`;
}

function placeholder(on: boolean): string {
  return on ? ON : OFF;
}

/** Step 1: swap each flag read for a placeholder. */
function bindPlaceholders(sf: SourceFile, key: string, state: FlagState, readers: string[]): void {
  const value = placeholder(state === 'on');
  const edits: Edit[] = [];
  for (const call of findFlagCalls(sf, readers, key)) {
    const parent = call.getParentWhileKind(SyntaxKind.ParenthesizedExpression) ?? call;
    const holder = parent.getParent();
    if (Node.isVariableDeclaration(holder) && holder.getInitializer() === parent) {
      const stmt = holder.getVariableStatement();
      const name = holder.getNameNode();
      if (!Node.isIdentifier(name)) throw new Unsupported('flag value is destructured', call.getStartLineNumber());
      if (!stmt || stmt.getDeclarationKind() !== VariableDeclarationKind.Const) {
        throw new Unsupported('flag is stored in a let/var, so it may change', call.getStartLineNumber());
      }
      if (stmt.isExported()) throw new Unsupported('flag variable is exported', call.getStartLineNumber());
      if (stmt.getDeclarations().length !== 1) {
        throw new Unsupported('flag variable shares a statement with other variables', call.getStartLineNumber());
      }
      for (const ref of name.findReferencesAsNodes()) {
        if (ref.getSourceFile() !== sf || ref === name) continue;
        if (Node.isShorthandPropertyAssignment(ref.getParent())) {
          throw new Unsupported('flag variable is passed in an object', ref.getStartLineNumber());
        }
        edits.push({ start: ref.getStart(), end: ref.getEnd(), text: value });
      }
      edits.push(lineRemoval(sf, stmt.getStart(), stmt.getEnd()));
    } else {
      edits.push({ start: call.getStart(), end: call.getEnd(), text: value });
    }
  }
  applyEdits(sf, edits);
}

/** Step 2: fold placeholders away, one edit at a time. */
function simplify(sf: SourceFile): void {
  for (let step = 0; step < MAX_STEPS; step++) {
    const ph = sf
      .getDescendantsOfKind(SyntaxKind.Identifier)
      .find((id) => id.getText() === ON || id.getText() === OFF);
    if (!ph) return;
    simplifyOne(sf, ph, ph.getText() === ON);
  }
  throw new Error('flagsweep: simplify did not finish');
}

function simplifyOne(sf: SourceFile, ph: Node, on: boolean): void {
  let node: Node = ph;
  while (Node.isParenthesizedExpression(node.getParent())) node = node.getParentOrThrow();
  const parent = node.getParentOrThrow();
  const line = ph.getStartLineNumber();

  if (Node.isPrefixUnaryExpression(parent) && parent.getOperatorToken() === SyntaxKind.ExclamationToken) {
    return replaceNode(sf, parent, placeholder(!on));
  }

  if (Node.isBinaryExpression(parent) && parent.getLeft() === node) {
    const op = parent.getOperatorToken().getKind();
    const right = parent.getRight();
    if (op === SyntaxKind.AmpersandAmpersandToken) {
      return on ? replaceExpression(sf, parent, right) : replaceNode(sf, parent, placeholder(false));
    }
    if (op === SyntaxKind.BarBarToken) {
      return on ? replaceNode(sf, parent, placeholder(true)) : replaceExpression(sf, parent, right);
    }
    if (op === SyntaxKind.QuestionQuestionToken) return replaceNode(sf, parent, placeholder(on));
  }

  if (Node.isConditionalExpression(parent) && parent.getCondition() === node) {
    return replaceExpression(sf, parent, on ? parent.getWhenTrue() : parent.getWhenFalse());
  }

  if (Node.isJsxExpression(parent) && isJsxChild(parent)) {
    // `{true}` and `{false}` both render nothing.
    return applyEdits(sf, [lineRemoval(sf, parent.getStart(), parent.getEnd())]);
  }

  if (Node.isIfStatement(parent) && parent.getExpression() === node) {
    return foldIf(sf, parent, on, line);
  }

  throw new Unsupported(`flag is used as ${describe(parent)}, which FlagSweep does not change`, line);
}

/** Replace an expression with one of its parts, cleaning up JSX `{...}` wrappers when we can. */
function replaceExpression(sf: SourceFile, target: Expression, replacement: Expression): void {
  let outer: Node = target;
  while (Node.isParenthesizedExpression(outer.getParent())) outer = outer.getParentOrThrow();
  const holder = outer.getParent();
  const inner = stripParens(replacement);

  if (holder && Node.isJsxExpression(holder) && isJsxChild(holder)) {
    if (isJsx(inner)) return replaceNode(sf, holder, inner.getText());
    if (isEmptyValue(inner)) return applyEdits(sf, [lineRemoval(sf, holder.getStart(), holder.getEnd())]);
  }
  // className={'v2'} -> className="v2"
  if (holder && Node.isJsxExpression(holder) && Node.isJsxAttribute(holder.getParent()) && Node.isStringLiteral(inner)) {
    const value = inner.getLiteralText();
    if (!/["\\\n]/.test(value)) return replaceNode(sf, holder, `"${value}"`);
  }
  replaceNode(sf, target, replacement.getText());
}

function foldIf(sf: SourceFile, ifStmt: IfStatement, on: boolean, line: number): void {
  const chosen = on ? ifStmt.getThenStatement() : ifStmt.getElseStatement();
  const parent = ifStmt.getParentOrThrow();

  // `else if (flag) {...}`: we are the else branch of another if.
  if (Node.isIfStatement(parent) && parent.getElseStatement() === ifStmt) {
    if (!chosen) return applyEdits(sf, [{ start: parent.getThenStatement().getEnd(), end: ifStmt.getEnd(), text: '' }]);
    return replaceNode(sf, ifStmt, chosen.getText());
  }

  if (!isStatementList(parent)) {
    throw new Unsupported(`if statement inside ${parent.getKindName()} without braces`, line);
  }

  if (!chosen) return applyEdits(sf, [lineRemoval(sf, ifStmt.getStart(), ifStmt.getEnd())]);

  const siblings = parent.getStatements();
  const after = siblings.slice(siblings.indexOf(ifStmt) + 1);
  const exits = endsWithExit(chosen);
  // Code after an unconditional return/throw is dead, so it goes too.
  const end = exits && after.length > 0 ? after[after.length - 1]!.getEnd() : ifStmt.getEnd();

  let text: string;
  if (Node.isBlock(chosen)) {
    if (chosen.getStatements().length === 0 && !exits) {
      return applyEdits(sf, [lineRemoval(sf, ifStmt.getStart(), end)]);
    }
    text = wouldShadow(chosen, parent, ifStmt, exits ? [] : after) ? chosen.getText() : unwrapBlock(sf, chosen, ifStmt);
  } else {
    text = chosen.getText();
  }
  applyEdits(sf, [{ start: ifStmt.getStart(), end, text }]);
}

/** Text inside `{ ... }`, moved out one indent level to where the if statement was. */
function unwrapBlock(sf: SourceFile, block: Block, ifStmt: IfStatement): string {
  const full = sf.getFullText();
  const inner = full.slice(block.getStart() + 1, block.getEnd() - 1).replace(/^[ \t]*\n/, '').replace(/\n[ \t]*$/, '');
  const lines = inner.split('\n');
  const indentOf = (s: string) => /^[ \t]*/.exec(s)![0];
  const fromIndent = lines.filter((l) => l.trim()).map(indentOf).reduce((a, b) => (b.length < a.length ? b : a), indentOf(lines[0] ?? ''));
  const toIndent = indentOf(lineAt(full, ifStmt.getStart()));
  return lines
    .map((l, i) => {
      const body = l.startsWith(fromIndent) ? l.slice(fromIndent.length) : l.trimStart();
      if (!body) return '';
      return i === 0 ? body : toIndent + body;
    })
    .join('\n');
}

/** Moving the block's declarations up a scope would clash with names already used there. */
function wouldShadow(block: Block, parent: Node, ifStmt: IfStatement, after: Statement[]): boolean {
  const declared = declaredNames(block.getStatements());
  if (declared.size === 0) return false;
  const used = new Set<string>();
  const others = (parent as unknown as { getStatements(): Statement[] }).getStatements().filter((s) => s !== ifStmt);
  for (const s of [...others, ...after]) for (const id of s.getDescendantsOfKind(SyntaxKind.Identifier)) used.add(id.getText());
  for (const s of others) for (const name of declaredNames([s])) used.add(name);
  const fn = parent.getParent();
  if (fn && Node.isFunctionLikeDeclaration(fn)) for (const p of fn.getParameters()) used.add(p.getName());
  return [...declared].some((n) => used.has(n));
}

function declaredNames(statements: Statement[]): Set<string> {
  const names = new Set<string>();
  for (const s of statements) {
    if (Node.isVariableStatement(s)) {
      for (const d of s.getDeclarations()) {
        const n = d.getNameNode();
        if (Node.isIdentifier(n)) names.add(n.getText());
        else for (const id of n.getDescendantsOfKind(SyntaxKind.Identifier)) names.add(id.getText());
      }
    } else if (Node.isFunctionDeclaration(s) || Node.isClassDeclaration(s)) {
      const n = s.getName();
      if (n) names.add(n);
    }
  }
  return names;
}

function endsWithExit(stmt: Statement): boolean {
  const last = Node.isBlock(stmt) ? stmt.getStatements().at(-1) : stmt;
  return (
    !!last &&
    (Node.isReturnStatement(last) || Node.isThrowStatement(last) || Node.isBreakStatement(last) || Node.isContinueStatement(last))
  );
}

/**
 * Step 3: remove imports and local helpers that only the removed code used.
 * A name is removed only if it was used before and no identifier with that name is left in the file.
 */
function removeNewlyUnused(sf: SourceFile, before: Map<string, number>): void {
  for (let pass = 0; pass < 20; pass++) {
    const now = identifierCounts(sf);
    const gone = (name: string) => (before.get(name) ?? 0) > 1 && (now.get(name) ?? 0) === 1;
    let removed = false;

    for (const imp of sf.getImportDeclarations()) {
      let touched = false;
      for (const spec of imp.getNamedImports()) {
        const local = (spec.getAliasNode() ?? spec.getNameNode()).getText();
        if (gone(local)) {
          spec.remove();
          touched = true;
        }
      }
      const def = imp.getDefaultImport();
      if (def && gone(def.getText())) {
        imp.removeDefaultImport();
        touched = true;
      }
      removed ||= touched;
      if (touched && !imp.getDefaultImport() && !imp.getNamespaceImport() && imp.getNamedImports().length === 0) {
        imp.remove();
      }
    }

    for (const stmt of sf.getDescendantsOfKind(SyntaxKind.VariableStatement)) {
      const [decl, ...rest] = stmt.getDeclarations();
      const name = decl?.getNameNode();
      if (!decl || rest.length > 0 || !Node.isIdentifier(name) || stmt.isExported()) continue;
      if (!gone(name.getText()) || !isPure(decl.getInitializer())) continue;
      applyEdits(sf, [lineRemoval(sf, stmt.getStart(), stmt.getEnd())]);
      removed = true;
      break;
    }

    if (!removed) return;
  }
}

/** Initializers we can drop without losing a side effect. */
function isPure(init: Node | undefined): boolean {
  if (!init) return true;
  const n = stripParens(init);
  return (
    Node.isArrowFunction(n) ||
    Node.isFunctionExpression(n) ||
    Node.isLiteralExpression(n) ||
    Node.isNoSubstitutionTemplateLiteral(n) ||
    Node.isIdentifier(n) ||
    Node.isTrueLiteral(n) ||
    Node.isFalseLiteral(n) ||
    isJsx(n)
  );
}

function identifierCounts(sf: SourceFile): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of sf.getDescendantsOfKind(SyntaxKind.Identifier)) {
    counts.set(id.getText(), (counts.get(id.getText()) ?? 0) + 1);
  }
  return counts;
}

// ---- small helpers ----

interface Edit {
  start: number;
  end: number;
  text: string;
}

function applyEdits(sf: SourceFile, edits: Edit[]): void {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  let text = sf.getFullText();
  let lastStart = Infinity;
  for (const e of sorted) {
    if (e.end > lastStart) throw new Error('flagsweep: overlapping edits');
    text = text.slice(0, e.start) + e.text + text.slice(e.end);
    lastStart = e.start;
  }
  sf.replaceWithText(text);
}

function replaceNode(sf: SourceFile, node: Node, text: string): void {
  applyEdits(sf, [{ start: node.getStart(), end: node.getEnd(), text }]);
}

/** Remove a range; if it fills its lines, remove those whole lines too. */
function lineRemoval(sf: SourceFile, start: number, end: number): Edit {
  const full = sf.getFullText();
  let s = start;
  while (s > 0 && (full[s - 1] === ' ' || full[s - 1] === '\t')) s--;
  let e = end;
  while (e < full.length && (full[e] === ' ' || full[e] === '\t' || full[e] === ';')) e++;
  const ownLine = (s === 0 || full[s - 1] === '\n') && (e === full.length || full[e] === '\n');
  if (!ownLine) return { start, end, text: '' };
  e = Math.min(e + 1, full.length);
  // Don't leave a blank line right after `{` / `(` or two blank lines in a row.
  const prev = lineAt(full, Math.max(s - 1, 0)).trim();
  const nextEnd = full.indexOf('\n', e);
  const next = full.slice(e, nextEnd === -1 ? undefined : nextEnd);
  const prevOpensOrBlank = s === 0 || prev === '' || /[{(]$/.test(prev);
  if (nextEnd !== -1 && next.trim() === '' && prevOpensOrBlank) e = nextEnd + 1;
  return { start: s, end: e, text: '' };
}

function lineAt(full: string, pos: number): string {
  const start = full.lastIndexOf('\n', pos - 1) + 1;
  const end = full.indexOf('\n', pos);
  return full.slice(start, end === -1 ? undefined : end);
}

function stripParens(node: Node): Node {
  let n = node;
  while (Node.isParenthesizedExpression(n)) n = n.getExpression();
  return n;
}

function isJsx(node: Node): boolean {
  return Node.isJsxElement(node) || Node.isJsxSelfClosingElement(node) || Node.isJsxFragment(node);
}

function isEmptyValue(node: Node): boolean {
  return Node.isNullLiteral(node) || Node.isFalseLiteral(node) || (Node.isIdentifier(node) && node.getText() === 'undefined');
}

function isJsxChild(expr: Node): boolean {
  const p = expr.getParent();
  return !!p && (Node.isJsxElement(p) || Node.isJsxFragment(p));
}

function isStatementList(node: Node): node is Block {
  return Node.isBlock(node) || Node.isSourceFile(node) || Node.isCaseClause(node) || Node.isDefaultClause(node) || Node.isModuleBlock(node);
}

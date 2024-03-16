import type * as acorn from 'acorn';
import { analyzeBlock, createBlock, createExpressionStatement } from './internal/analyze.ts';

export type AnalyzeFunction = {
  /**
   * What refs the function uses externally, and whether the access is read-only (`false`) or read-write (`true`).
   */
  external: Map<string, boolean>;
};

/**
 * Given a function, determine what it uses from outside the function.
 */
export function analyzeFunction(f: acorn.Function): AnalyzeFunction {
  let expr: acorn.FunctionExpression | acorn.ArrowFunctionExpression;

  if (!f.expression) {
    expr = {
      ...(f as acorn.FunctionDeclaration),
      type: 'FunctionExpression',
    };
  } else {
    expr = f as acorn.FunctionExpression;
  }

  const b = createBlock(createExpressionStatement(expr));
  const internal = analyzeBlock(b);

  const out: AnalyzeFunction = { external: new Map() };

  for (const [key, info] of internal.vars) {
    if (info.kind) {
      continue;
    }
    out.external.set(key, info.written || info.nestedWrite);
  }

  return out;
}

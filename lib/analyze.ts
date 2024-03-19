import type * as acorn from 'acorn';
import { createBlock, createExpressionStatement } from './internal/analyze/helper.ts';
import { AnalyzeBlock, analyzeBlock } from './internal/analyze/block.ts';

/**
 * Given a function, determine what it uses from outside the function.
 */
export function analyzeFunction(f: acorn.Function): AnalyzeBlock {
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

  for (const [key, info] of internal.vars) {
    if (info.local?.kind) {
      internal.vars.delete(key);
    }
  }

  return internal;
}

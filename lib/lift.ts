import { StaticExtractor } from './extractor.ts';
import type * as acorn from 'acorn';

export function liftDefault(e: StaticExtractor, minSize: number) {
  // lift top-level fn blocks
  for (const part of e.block.body) {
    const size = part.end - part.start;
    if (part.type === 'FunctionDeclaration' && size >= minSize) {
      e.liftFunctionDeclaration(part);
    }
  }

  const maybeLiftExpr: acorn.Expression[] = [];
  for (const part of e.block.body) {
    switch (part.type) {
      case 'ExpressionStatement':
        if (part.expression.type === 'AssignmentExpression') {
          // find things on the right of "="
          // this won't lift normally (the left part changes)
          maybeLiftExpr.push(part.expression.right);
        } else {
          // try the whole thing? :shrug:
          maybeLiftExpr.push(part.expression);
        }
        continue;

      case 'VariableDeclaration':
        for (const decl of part.declarations) {
          decl.init && maybeLiftExpr.push(decl.init);
        }
        continue;

      case 'ReturnStatement':
        // why not? might be big
        part.argument && maybeLiftExpr.push(part.argument);
        continue;
    }
  }

  for (const expr of maybeLiftExpr) {
    const size = expr.end - expr.start;
    if (size >= minSize) {
      e.liftExpression(expr);
    }
  }
}

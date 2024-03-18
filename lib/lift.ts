import { StaticExtractor } from './extractor.ts';
import type * as acorn from 'acorn';

export function liftDefault(e: StaticExtractor, minSize: number) {
  const stats = {
    fn: 0,
    expr: 0,
    assignment: 0,
    _skip: 0,
  };

  // lift top-level fn blocks
  for (const part of e.block.body) {
    const size = part.end - part.start;
    if (part.type === 'FunctionDeclaration' && size >= minSize) {
      if (e.liftFunctionDeclaration(part)) {
        stats.fn++;
      } else {
        stats._skip++;
      }
    }
  }

  // lift expressions in a few places (all top-level though)
  const maybeLift = (expr: acorn.Expression | null | undefined, ok: () => void) => {
    if (!expr) {
      return;
    }
    const size = expr.end - expr.start;
    if (size < minSize) {
      return;
    }
    if (e.liftExpression(expr)) {
      ok();
    } else {
      stats._skip++;
    }
  };
  for (const part of e.block.body) {
    switch (part.type) {
      case 'ExpressionStatement':
        if (part.expression.type === 'AssignmentExpression') {
          // find things on the right of "="
          // this won't lift normally (the left part changes)
          maybeLift(part.expression.right, () => stats.assignment++);
        } else {
          // try the whole thing? :shrug:
          maybeLift(part.expression, () => stats.expr++);
        }
        continue;

      case 'VariableDeclaration':
        for (const decl of part.declarations) {
          maybeLift(decl.init, () => stats.assignment++);
        }
        continue;

      case 'ReturnStatement':
        // why not? might be big
        maybeLift(part.argument, () => stats.expr++);
        continue;
    }
  }

  return stats;
}

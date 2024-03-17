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

  // find things on the right of "="
  const maybeLiftExpr: acorn.Expression[] = [
    ...(e.block.body
      .map((s) =>
        s.type === 'ExpressionStatement' && s.expression.type === 'AssignmentExpression'
          ? s.expression.right
          : null,
      )
      .filter((x) => x !== null) as acorn.FunctionExpression[]),
    ...(e.block.body
      .map((s) => (s.type === 'VariableDeclaration' ? s.declarations.map((d) => d.init) : []))
      .flat()
      .filter((x) => x !== null) as acorn.Expression[]),
  ].filter((expr) => {
    const size = expr.end - expr.start;
    return size >= minSize;
  });
  for (const expr of maybeLiftExpr) {
    e.liftExpression(expr);
  }
}

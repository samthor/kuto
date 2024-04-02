import { StaticExtractor } from './extractor.ts';
import type * as acorn from 'acorn';
import { analyzeBlock } from './internal/analyze/block.ts';
import { reductifyFunction } from './internal/analyze/expression.ts';
import { createBlock } from './internal/analyze/helper.ts';

export function liftDefault(e: StaticExtractor, minSize: number) {
  const stats = {
    fn: 0,
    class: 0,
    expr: 0,
    assignment: 0,
    _skip: 0,
  };

  // lift a subpath of a complex statement
  const innerLiftMaybeBlock = (b: acorn.Statement | null | undefined, dirty: string[]) => {
    if (!b) {
      return;
    }
    if (b.type !== 'BlockStatement') {
      if (b.type === 'VariableDeclaration') {
        // only valid thing is 'if (1) var x = ...', nope nope nope
        return;
      }
      b = createBlock(b); // treat as miniblock
    } else {
      const a = analyzeBlock(b, { nest: false });
      const declaredHere: string[] = [];
      a.vars.forEach((info, key) => {
        if (info.local?.kind) {
          declaredHere.push(key);
        }
      });
      dirty = dirty.concat(declaredHere);
    }

    innerLift(b, dirty);
  };

  const innerLift = (b: acorn.BlockStatement, dirty: string[]) => {
    const maybeLift = (expr: acorn.Expression | null | undefined, ok: () => void) => {
      if (!expr) {
        return;
      }
      const size = expr.end - expr.start;
      if (size < minSize) {
        return;
      }
      if (e.liftExpression(expr, dirty)) {
        ok();
      } else {
        ++stats._skip;
      }
    };

    for (const part of b.body) {
      switch (part.type) {
        case 'ExpressionStatement':
          if (
            part.expression.type === 'CallExpression' &&
            (part.expression.callee.type === 'FunctionExpression' ||
              part.expression.callee.type === 'ArrowFunctionExpression')
          ) {
            // IIFE
            const r = reductifyFunction(part.expression.callee);
            innerLiftMaybeBlock(r, dirty);
          } else if (part.expression.type === 'AssignmentExpression') {
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

        // -- nested control statements below here

        case 'WhileStatement':
        case 'DoWhileStatement':
          innerLiftMaybeBlock(part.body, dirty);
          break;

        case 'IfStatement':
          innerLiftMaybeBlock(part.consequent, dirty);
          innerLiftMaybeBlock(part.alternate, dirty);
          break;

        case 'BlockStatement':
          innerLiftMaybeBlock(part, dirty);
          break;

        case 'TryStatement':
          innerLiftMaybeBlock(part.block, dirty);
          // TODO: include handler (maybe declares var)
          innerLiftMaybeBlock(part.finalizer, dirty);
          break;

        // TODO: include for/etc which can declare vars
      }
    }
  };

  // lift top-level fn blocks
  for (const part of e.block.body) {
    const size = part.end - part.start;
    if (size < minSize) {
      continue;
    }

    switch (part.type) {
      case 'FunctionDeclaration':
        if (e.liftFunctionDeclaration(part)) {
          ++stats.fn;
        } else {
          ++stats._skip;
        }
        break;

      case 'ClassDeclaration':
        // TODO: esbuild (and friends?) _already_ transform these to `const ClassName = class { ... }`,
        // so in already bundled code you don't actually see this. So it's important but less immediate.
        if (e.liftClassDeclaration(part)) {
          ++stats.class;
        } else {
          ++stats._skip;
        }
    }
  }

  // follow top-level statements
  innerLift(e.block, []);

  return stats;
}

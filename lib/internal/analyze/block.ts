import type * as acorn from 'acorn';
import { createBlock, createExpressionStatement, processPattern } from './helper.ts';
import { MarkIdentifierFn, processExpression } from './expression.ts';

function reductifyStatement(
  b: acorn.Statement,
): acorn.BlockStatement | acorn.Expression | acorn.VariableDeclaration | void {
  switch (b.type) {
    case 'LabeledStatement':
      return reductifyStatement(b.body);

    case 'EmptyStatement':
    case 'ContinueStatement':
    case 'BreakStatement':
    case 'DebuggerStatement':
      return undefined;

    case 'BlockStatement':
      return b;

    case 'ExpressionStatement':
      return b.expression;

    case 'ReturnStatement':
    case 'ThrowStatement':
      return b.argument ?? undefined;

    case 'VariableDeclaration':
      return b;

    case 'FunctionDeclaration': {
      // pretend to be "let foo = function foo() { ... }"
      const decl: acorn.VariableDeclarator = {
        type: 'VariableDeclarator',
        start: -1,
        end: -1,
        id: b.id,
        init: {
          type: 'FunctionExpression',
          start: -1,
          end: -1,
          async: b.async,
          generator: b.generator,
          params: b.params,
          expression: true, // not really but fine
          id: b.id,
          body: b.body,
        },
      };
      return {
        type: 'VariableDeclaration',
        start: -1,
        end: -1,
        kind: 'let',
        declarations: [decl],
      };
    }

    case 'ClassDeclaration': {
      // pretend to be "const Foo = class Foo { ... }"
      const decl: acorn.VariableDeclarator = {
        type: 'VariableDeclarator',
        start: -1,
        end: -1,
        id: b.id,
        init: {
          type: 'ClassExpression',
          start: -1,
          end: -1,
          id: b.id,
          superClass: b.superClass,
          body: b.body,
        },
      };
      return {
        type: 'VariableDeclaration',
        start: -1,
        end: -1,
        kind: 'const',
        declarations: [decl],
      };
    }

    case 'IfStatement': {
      const body: acorn.Statement[] = [createExpressionStatement(b.test), b.consequent];
      b.alternate && body.push(b.alternate);
      return createBlock(...body);
    }

    case 'WhileStatement':
      return createBlock(createExpressionStatement(b.test), b.body);

    case 'DoWhileStatement':
      return createBlock(b.body, createExpressionStatement(b.test));

    case 'SwitchStatement': {
      const body: acorn.Statement[] = [createExpressionStatement(b.discriminant)];
      for (const c of b.cases) {
        c.test && body.push(createExpressionStatement(c.test));
        body.push(...c.consequent);
      }
      return createBlock(...body);
    }

    case 'ForStatement': {
      const body: acorn.Statement[] = [];

      if (b.init?.type === 'VariableDeclaration') {
        body.push(b.init);
      } else if (b.init) {
        body.push(createExpressionStatement(b.init));
      }
      b.test && body.push(createExpressionStatement(b.test));
      b.update && body.push(createExpressionStatement(b.update));
      body.push(b.body);

      return createBlock(...body);
    }

    case 'ForInStatement':
    case 'ForOfStatement': {
      const body: acorn.Statement[] = [];

      if (b.left.type === 'VariableDeclaration') {
        body.push(b.left);
      } else {
        const { expression } = processPattern(b.left);
        body.push(createExpressionStatement(expression));
      }

      body.push(createExpressionStatement(b.right));
      body.push(b.body);

      return createBlock(...body);
    }

    case 'TryStatement': {
      const rest: acorn.Statement[] = [];

      if (b.handler) {
        if (b.handler.param) {
          // "catch (foo)" => something like "let foo"
          const decl: acorn.VariableDeclaration = {
            type: 'VariableDeclaration',
            start: -1,
            end: -1,
            declarations: [
              {
                type: 'VariableDeclarator',
                start: -1,
                end: -1,
                id: b.handler.param,
              },
            ],
            kind: 'let',
          };
          rest.push(createBlock(decl, b.handler.body));
        } else {
          rest.push(b.handler.body);
        }
      }
      b.finalizer && rest.push(b.finalizer);

      return createBlock(b.block, ...rest);
    }

    default:
      throw new Error(`unsupported: ${b.type}`);
  }
}

export type VarInfo = {
  /**
   * Is this used locally, and how often is it written.
   */
  local?: {
    writes: number;
    kind?: 'let' | 'var' | 'const';
  };

  /**
   * Is this used in a nested callable block, and if so, how many times is it written.
   */
  nested?: { writes: number };
};

export type AnalyzeBlock = {
  vars: Map<string, VarInfo>;
  hasNested: boolean;
  hasAwait: boolean;
};

export function analyzeBlock(b: acorn.BlockStatement, args?: { nest?: boolean }): AnalyzeBlock {
  const out: AnalyzeBlock = { vars: new Map(), hasNested: false, hasAwait: false };
  const mark: MarkIdentifierFn = (name, arg) => {
    if ('special' in arg) {
      // this is a short-circuit to mark hasNested
      if (name) {
        throw new Error(`mark special called wrong`);
      }
      if (arg.special.nested) {
        out.hasNested = true;
      }
      if (arg.special.await) {
        out.hasAwait = true;
      }
      return;
    }
    if (!name) {
      throw new Error(`should be called with special`);
    }
    const { nested, writes } = arg;

    const info = out.vars.get(name);
    if (info === undefined) {
      // pure use: not declared here
      out.vars.set(name, nested ? { nested: { writes } } : { local: { writes } });
    } else if (nested) {
      // used by a callable within here
      info.nested ??= { writes: 0 };
      info.nested.writes += writes;
    } else {
      // used locally
      info.local ??= { writes: 0 };
      info.local.writes += writes;
    }
  };

  for (const raw of b.body) {
    const simple = reductifyStatement(raw) ?? { type: 'EmptyStatement' };
    switch (simple.type) {
      case 'BlockStatement': {
        if (args?.nest === false) {
          break; // we can skip descending in some cases
        }

        const inner = analyzeBlock(simple);

        for (const [key, info] of inner.vars) {
          if (info.local?.kind && ['let', 'const'].includes(info.local?.kind)) {
            // doesn't escape inner block
            continue;
          }

          const prev = out.vars.get(key);
          if (prev === undefined) {
            // no merging required: either 'var' or external ref
            out.vars.set(key, info);
            continue;
          }

          if (info.local) {
            prev.local ??= { writes: 0 };
            prev.local.writes += info.local.writes;

            if (info.local.kind === 'var') {
              if (prev.local?.kind && prev.local.kind !== 'var') {
                // inner 'var' found an outer 'let' or 'const'
                throw new Error(`got kind mismatch: inner 'var' found outer '${prev.local.kind}'`);
              }
              prev.local.kind = 'var';
            }
          }

          if (info.nested) {
            prev.nested ??= { writes: 0 };
            prev.nested.writes += info.nested.writes;
          }
        }
        break;
      }

      case 'VariableDeclaration': {
        for (const declaration of simple.declarations) {
          const p = processPattern(declaration.id);

          // can be unwritten in let/var without initializer
          const written = Boolean(p.init || declaration.init);
          const writes = written ? 1 : 0;

          for (const name of p.names) {
            const prev = out.vars.get(name);
            if (prev === undefined) {
              out.vars.set(name, { local: { writes, kind: simple.kind } });
              continue;
            }

            if (prev.local?.kind && (simple.kind !== 'var' || prev.local.kind !== 'var')) {
              throw new Error(
                `got kind mismatch: can only redeclare 'var', was '${prev.local.kind}' got '${simple.kind}'`,
              );
            }
            prev.local ??= { writes: 0 };
            prev.local.kind = simple.kind;
            prev.local.writes += writes;
          }

          p.init && processExpression(p.init, mark);
          declaration.init && processExpression(declaration.init, mark);
        }
        break;
      }

      case 'EmptyStatement':
        continue;

      default:
        processExpression(simple, mark);
    }
  }

  return out;
}

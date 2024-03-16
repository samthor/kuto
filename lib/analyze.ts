import * as acorn from 'acorn';
import { aggregateImports } from './internal/module.ts';
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

export function analyzeProgram(p: acorn.Program) {
  const agg = aggregateImports(p);
  const analysis = analyzeBlock(createBlock(...agg.rest));

  // resolve live-bindings - look for writes inside later callables
  for (const info of agg.exports.values()) {
    if (info.import || info.const) {
      continue;
    }

    const v = analysis.vars.get(info.name)!;
    if (!v) {
      throw new Error(`exported var ${JSON.stringify(info.name)} is missing`);
    }
    info.const = !v.nestedWrite;
  }

  // find all (simple) functions and see if we can yeet them
  const functions = agg.rest.filter(
    (s) => s.type === 'FunctionDeclaration' && analysis.vars.get(s.id.name)?.simple,
  ) as acorn.FunctionDeclaration[];

  const staticRemove = new Map<
    string,
    { source: acorn.FunctionDeclaration; locals: Set<string>; globals: Set<string> }
  >();

  outer: for (const fn of functions) {
    const inner = analyzeFunction(fn);
    const globals = new Set<string>();
    const locals = new Set<string>();

    for (const [key, rw] of inner.external.entries()) {
      const toplevel = analysis.vars.get(key)!;
      if (!toplevel.kind) {
        globals.add(key);
      } else if (rw) {
        continue outer; // can't rw toplevel right now
      } else {
        locals.add(key);
      }
    }

    staticRemove.set(fn.id.name, {
      source: fn,
      locals,
      globals,
    });
  }

  console.info(agg.exports, { staticRemove });
}

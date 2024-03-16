import * as acorn from 'acorn';
import { aggregateImports } from './internal/module.ts';
import { analyzeBlock, createBlock } from './internal/analyze.ts';

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
  throw new Error('TODO');
}

export function analyzeProgram(p: acorn.Program) {
  const o = aggregateImports(p);
  const a = analyzeBlock(createBlock(...o.rest));

  for (const [name, info] of o.exports) {
    if (info.import || info.const) {
      continue;
    }

    const v = a.vars.get(info.name)!;
    if (!v) {
      throw new Error(`exported var ${JSON.stringify(info.name)} is missing`);
    }
    info.const = !v.nestedWrite;
  }

  console.info(o.exports);
}

import * as acorn from 'acorn';

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

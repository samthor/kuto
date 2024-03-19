import { AnalyzeBlock, VarInfo } from './internal/analyze/block.ts';
import { AggregateImports } from './internal/analyze/module.ts';
import { ImportInfo, ModDef } from './internal/moddef.ts';

export function resolveConst(agg: AggregateImports, analysis: AnalyzeBlock) {
  // resolve whether local vars are const - look for writes inside later callables
  // TODO: this doesn't explicitly mark their exported names as const, can look later?
  // nb. not _actually_ used yet
  for (const name of agg.mod.localExported()) {
    if (agg.localConst.has(name)) {
      continue;
    }

    const v = analysis.vars.get(name)!;
    if (!v) {
      throw new Error(`local exported var ${JSON.stringify(name)} is missing`);
    }
    if (!v.nested?.writes) {
      // it may be written _many_ times locally but never nested, const by end of file
      agg.localConst.add(name);
    }
  }

  return agg.localConst;
}

type FindVarsArgs = {
  find: Map<string, VarInfo>;
  vars: Map<string, VarInfo>;
  mod: ModDef;
};

export function findVars({ find, vars, mod }: FindVarsArgs) {
  const globals = new Map<string, boolean>();
  const imports = new Map<string, ImportInfo>();
  const locals = new Map<string, boolean>();
  let anyRw = false;
  let immediateAccess = false;

  for (const [key, check] of find) {
    const rw = Boolean(check.local?.writes || check.nested?.writes);
    anyRw ||= rw;
    immediateAccess ||= Boolean(check.local);

    const vi = vars.get(key)!;
    if (!vi.local?.kind) {
      const importInfo = mod.lookupImport(key);
      if (importInfo) {
        imports.set(key, importInfo);
        continue;
      }
      globals.set(key, rw);
    } else {
      locals.set(key, rw);
    }
  }

  return { globals, imports, locals, rw: anyRw, immediateAccess };
}

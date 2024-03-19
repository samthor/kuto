import type { AnalyzeBlock, VarInfo } from './internal/analyze.ts';
import { ImportInfo, ModDef } from './internal/moddef.ts';
import type { AggregateImports } from './internal/module.ts';

type FindType = Map<string, boolean | VarInfo>;

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
    if (!v.nestedWrite) {
      agg.localConst.add(name);
    }
  }

  return agg.localConst;
}

type FindVarsArgs = {
  find: Map<string, boolean | VarInfo>;
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
    let rw: boolean;
    if (typeof check === 'object') {
      rw = check.written || check.nestedWrite;
      immediateAccess ||= check.local;
    } else {
      rw = check;
    }

    const vi = vars.get(key)!;
    if (!vi.kind) {
      const importInfo = mod.lookupImport(key);
      if (importInfo) {
        imports.set(key, importInfo);
        continue;
      }

      globals.set(key, rw);
      if (typeof check === 'object' && check.local) {
        // used global outside function, could be anything - can't allow
        immediateAccess = true;
      }
      continue;
    }

    anyRw ||= rw;
    locals.set(key, rw);
  }

  return { globals, imports, locals, rw: anyRw, immediateAccess };
}

import * as acorn from 'acorn';
import { aggregateImports } from './internal/module.ts';
import { analyzeBlock, createBlock } from './internal/analyze.ts';
import { analyzeFunction } from './analyze.ts';
import { ModDef } from './internal/moddef.ts';

export function extractStatic(raw: string, arg: { sourceName: string; staticName: string }) {
  const p = acorn.parse(raw, { ecmaVersion: 'latest', sourceType: 'module' });

  const agg = aggregateImports(p);
  const analysis = analyzeBlock(createBlock(...agg.rest));

  // resolve whether local vars are const - look for writes inside later callables
  // TODO: this doesn't explicitly mark their exported names as const, can look later?
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
        continue outer; // can't rw toplevel right now - would need to add exported setter
      } else {
        locals.add(key);
      }
    }

    staticRemove.set(fn.id.name, {
      source: fn,
      locals,
      globals,
    });
    agg.mod.addImport(arg.staticName, fn.id.name);
  }

  const moddefStatic = new ModDef();

  // find any locals that are NOT being moved; we need to export them here
  // const staticMustImport = new Map<string, { name: string; import?: string }>();
  // const extraExport = new Set<string>();
  for (const info of staticRemove.values()) {
    // check if global was actually an import - copy it over to static file
    for (const global of info.globals) {
      const importInfo = agg.mod.lookupImport(global);
      if (importInfo === undefined) {
        continue;
      }
      moddefStatic.addImport(importInfo.import, global, importInfo.remote);
    }

    // check locals we need to export from main - preemptively export it
    for (const local of info.locals) {
      if (!staticRemove.has(local)) {
        // TODO: if this exported name is already used by something else (??), this will crash
        agg.mod.addExportLocal(local);
        moddefStatic.addImport(arg.sourceName, local);
      }
    }
  }

  // TODO: `default` is rewritten badly - special-case it?
  const statementsToRemove = new Set<acorn.Statement>();
  for (const { source } of staticRemove.values()) {
    statementsToRemove.add(source);
  }

  let outMain = render(
    raw,
    agg.rest.filter((source) => !statementsToRemove.has(source)),
  );
  outMain += agg.mod.renderSource();

  let outStatic = render(
    raw,
    agg.rest.filter((source) => statementsToRemove.has(source)),
  );
  outStatic += moddefStatic.renderSource();

  return {
    source: {
      original: raw,
      main: outMain,
      static: outStatic,
    },
  };
}

function render(raw: string, parts: { start: number; end: number }[]) {
  let out = '';
  for (const p of parts) {
    out += raw.substring(p.start, p.end) + '\n'; // TODO: semi for safety?
  }
  return out;
}

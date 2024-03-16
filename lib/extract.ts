import * as acorn from 'acorn';
import { aggregateImports } from './internal/module.ts';
import { analyzeBlock, createBlock } from './internal/analyze.ts';
import { analyzeFunction } from './analyze.ts';
import { ModDef } from './internal/moddef.ts';
import { withDefault } from './helper.ts';

export type ExtractStaticArgs = {
  source: string;
  sourceName: string;
  staticName: string;
  existingStaticSource: Map<string, string>;
};

export function extractStatic(args: ExtractStaticArgs) {
  const p = acorn.parse(args.source, { ecmaVersion: 'latest', sourceType: 'module' });

  const agg = aggregateImports(p);
  const analysis = analyzeBlock(createBlock(...agg.rest));

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

  // analyze all static files
  const existingByCode: Map<string, { name: string; import: string }> = new Map();
  args.existingStaticSource.forEach((source, path) => {
    const p = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
    const agg = aggregateImports(p);

    for (const r of agg.rest) {
      if (r.type !== 'FunctionDeclaration') {
        continue;
      }

      const code = source.substring(r.start, r.end);
      if (existingByCode.has(code)) {
        continue;
      }
      existingByCode.set(code, { name: r.id.name, import: path });
    }
  });

  // find all (simple) functions and see if we can yeet them
  const functions = agg.rest.filter(
    (s) =>
      // fn only for now
      s.type === 'FunctionDeclaration' &&
      // too hard
      analysis.vars.get(s.id.name)?.simple &&
      // can't rewrite 'default'
      s.id.name !== 'default',
  ) as acorn.FunctionDeclaration[];

  // TODO: this is needed for React stuff, uses lots of default (but maybe not in _bundle_?)
  agg.rest.forEach((s) => {
    if (s.type === 'FunctionDeclaration' && s.id.name === 'default') {
      // creates wacky code (decl without name), unsupported right now
      throw new Error(`TODO: can't handle default fn yet`);
    }
  });

  const staticRemove = new Map<
    string,
    { locals: Set<string>; globals: Set<string>; static: { mod: ModDef } }
  >();
  const removeDecl = new Set<acorn.Statement>();
  // const moddefStatic = new ModDef();

  const staticToWrite = new Map<
    string,
    {
      mod: ModDef;
      body: acorn.Statement[];
    }
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

    // find where to write this code - "old" or "new"
    let targetStaticName = args.staticName;
    const code = args.source.substring(fn.start, fn.end);
    const existing = existingByCode.get(code);
    if (existing) {
      targetStaticName = existing.import;
    }

    const targetStatic = withDefault(staticToWrite, targetStaticName, () => ({
      mod: new ModDef(),
      body: [],
    }));

    removeDecl.add(fn);
    targetStatic.body.push(fn);
    staticRemove.set(fn.id.name, {
      locals,
      globals,
      static: targetStatic,
    });
    targetStatic.mod.addExportLocal(fn.id.name);
    agg.mod.addImport(targetStaticName, fn.id.name);
  }

  // find any locals that are NOT being moved; we need to export them here
  for (const info of staticRemove.values()) {
    // check if global was actually an import - copy it over to static file
    for (const global of info.globals) {
      const importInfo = agg.mod.lookupImport(global);
      if (importInfo === undefined) {
        continue;
      }
      info.static.mod.addImport(importInfo.import, global, importInfo.remote);
    }

    // check locals we need to export from main - preemptively export it
    for (const local of info.locals) {
      if (!staticRemove.has(local)) {
        // TODO: if this exported name is already used by something else (??), this will crash
        agg.mod.addExportLocal(local);
        info.static.mod.addImport(args.sourceName, local);
      }
    }
  }

  let outMain = render(
    args.source,
    agg.rest.filter((s) => !removeDecl.has(s)),
  );
  outMain += agg.mod.renderSource();

  const outStatic = new Map<string, string>();
  for (const [targetStaticName, info] of staticToWrite) {
    let code = render(args.source, info.body);
    code += info.mod.renderSource();
    outStatic.set(targetStaticName, code);
  }

  return {
    source: {
      original: args.source,
      main: outMain,
      static: outStatic,
    },
  };
}

function render(raw: string, parts: Iterable<{ start: number; end: number }>) {
  let out = '';
  for (const p of parts) {
    out += raw.substring(p.start, p.end) + '\n'; // TODO: semi for safety?
  }
  return out;
}

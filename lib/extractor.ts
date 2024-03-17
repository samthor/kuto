import * as acorn from 'acorn';
import { AggregateImports, aggregateImports } from './internal/module.ts';
import {
  VarInfo,
  analyzeBlock,
  createBlock,
  createExpressionStatement,
} from './internal/analyze.ts';
import { analyzeFunction } from './analyze.ts';
import { withDefault } from './helper.ts';
import { ModDef } from './internal/moddef.ts';

export type ExtractStaticArgs = {
  source: string;
  sourceName: string;
  staticName: string;
  existingStaticSource: Map<string, string>;
};

type FindType = Map<string, boolean | { written: boolean; nestedWrite: boolean }>;

function extractExistingStaticCode(raw: Iterable<[string, string]>) {
  const existingByCode: Map<string, { name: string; import: string }> = new Map();

  for (const [path, source] of raw) {
    const p = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
    const agg = aggregateImports(p);

    const add = (node: acorn.Node, name: string) => {
      const code = source.substring(node.start, node.end);
      if (!existingByCode.has(code)) {
        existingByCode.set(code, { name, import: path });
      }
    };

    // TODO: this doesn't check that the things are exported _as_ this name, but it's what we build

    for (const r of agg.rest) {
      switch (r.type) {
        case 'FunctionDeclaration':
          add(r, r.id.name);
          break;

        case 'VariableDeclaration': {
          for (const decl of r.declarations) {
            if (decl.init && decl.id.type === 'Identifier') {
              add(decl.init, decl.id.name);
            }
          }
          break;
        }
      }
    }
  }

  return existingByCode;
}

/**
 * Helper that wraps up the behavior of extracting static code from a main source file.
 *
 * Users basically pass in the arguments, pull back the generated {@link acorn.BlockStatement}, and find parts that will be swapped out.
 */
export class StaticExtractor {
  private args: ExtractStaticArgs;
  private agg: AggregateImports;
  private vars: Map<string, VarInfo>;
  private existingByCode: Map<string, { name: string; import: string }>;
  private _block: acorn.BlockStatement;
  private count = 0;

  private staticToWrite = new Map<
    string,
    {
      mod: ModDef;
      body: (string | acorn.Statement)[];
      here: Set<string>;
    }
  >();
  private staticVars = new Set<string>();

  private nodesToReplace = new Map<acorn.Node, string>();

  constructor(args: ExtractStaticArgs) {
    this.args = { ...args };

    // analyze all provided existing statics, record used vars
    this.existingByCode = extractExistingStaticCode(args.existingStaticSource);
    for (const info of this.existingByCode.values()) {
      this.staticVars.add(`${info.name}~${info.import}`);
    }

    // parse original source
    const p = acorn.parse(args.source, { ecmaVersion: 'latest', sourceType: 'module' });

    // analyze parsed
    const agg = aggregateImports(p);
    this._block = createBlock(...agg.rest);
    const analysis = analyzeBlock(this._block);
    this.agg = agg;
    this.vars = analysis.vars;

    // TODO: detect 'default' function or class decl without other name: currently broken
    for (const p of this._block.body) {
      switch (p.type) {
        case 'ClassDeclaration':
        case 'FunctionDeclaration':
          if (p.id.name === 'default') {
            throw new Error(`TODO: can't operate on default function/class`);
          }
      }
    }

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
  }

  get block() {
    return this._block;
  }

  /**
   * Finds and returns a new valid variable name for the static file.
   */
  private varForStatic(staticName: string, prefix = '_') {
    for (let i = 1; i < 10_000; ++i) {
      const cand = `${prefix}${i}`;
      const check = `${cand}~${staticName}`;
      if (!this.staticVars.has(check)) {
        this.staticVars.add(check);
        return cand;
      }
    }
    throw new Error(`could not make var for static: ${staticName}`);
  }

  private findVars(arg: FindType) {
    const globals = new Set<string>();
    const locals = new Map<string, boolean>();
    let anyRw = false;

    for (const [key, check] of arg) {
      const vi = this.vars.get(key)!;
      if (!vi.kind) {
        globals.add(key); // might be an import into main file
        continue;
      }

      let rw: boolean;
      if (typeof check === 'object') {
        rw = check.written || check.nestedWrite;
      } else {
        rw = check;
      }
      anyRw ||= rw;
      locals.set(key, rw);
    }

    return { globals, locals, rw: anyRw };
  }

  private addCodeToStatic(args: { node: acorn.Node; find: FindType; decl?: boolean }) {
    const find = this.findVars(args.find);
    if (find.rw) {
      return null; // no support for rw
    }

    let name: string = '';
    let targetStaticName = this.args.staticName;
    let code = this.args.source.substring(args.node.start, args.node.end);
    const existing = this.existingByCode.get(code);
    if (existing) {
      targetStaticName = existing.import;
      name = existing.name;
    }

    // determine what name this has (generated or part of the fn/class hoisted)
    if (!name) {
      if (args.decl) {
        name = this.varForStatic(targetStaticName);
      } else if ('id' in args.node) {
        const id = args.node.id as acorn.Identifier;
        if (id.type === 'Identifier') {
          name = id.name;
        }
      }
    }
    if (!name || name === 'default') {
      throw new Error(`could not name code put into static: ${args}`);
    }

    // TODO: (for decl) guessing at valid names in main
    const localName = args.decl ? `_${++this.count}` : name;

    // remove from output
    this.nodesToReplace.set(args.node, args.decl ? localName : '');

    const targetStatic = withDefault(this.staticToWrite, targetStaticName, () => ({
      mod: new ModDef(),
      body: [],
      here: new Set<string>(),
    }));
    targetStatic.body.push(args.decl ? `const ${name} = ${code};` : code);
    targetStatic.here.add(name);

    // export from static back to main
    targetStatic.mod.addExportLocal(name);
    this.agg.mod.addImport(targetStaticName, localName, name);

    // redirect external imports (globals that are from another source)
    for (const g of find.globals) {
      const importInfo = this.agg.mod.lookupImport(g);
      if (importInfo === undefined) {
        continue; // actual global! ignore
      }
      targetStatic.mod.addImport(importInfo.import, g, importInfo.remote);
    }

    // import locals from main (this might be a complex redir)
    for (const l of find.locals.keys()) {
      this.agg.mod.addExportLocal(l);
      targetStatic.mod.addImport(this.args.sourceName, l);
    }
  }

  liftFunctionDeclaration(fn: acorn.FunctionDeclaration) {
    const vi = this.vars.get(fn.id.name);
    if (vi === undefined || !vi.simple) {
      return null;
    }

    const { external } = analyzeFunction(fn);
    this.addCodeToStatic({ node: fn, find: external });
  }

  liftExpression(e: acorn.Expression) {
    if (!(e.type === 'FunctionExpression' || e.type === 'ArrowFunctionExpression')) {
      // TODO: later, can handle stateless (no deps - big literals, arrays etc)
      return null;
    }

    const { vars } = analyzeBlock(createBlock(createExpressionStatement(e)));
    this.addCodeToStatic({ node: e, find: vars, decl: true });
  }

  build() {
    // render statics
    const outStatic = new Map<string, string>();
    for (const [targetStaticName, info] of this.staticToWrite) {
      let code = info.body
        .map((p) => (typeof p === 'string' ? p : this.args.source.substring(p.start, p.end)))
        .join('');

      // we import everything we need, even things that may be in _this static_
      // reconcile it by removing things we have, before render
      // TODO: we could import them from _another_ static? ordering issues?
      for (const h of info.here) {
        info.mod.removeImport(h);
      }
      code += info.mod.renderSource();

      outStatic.set(targetStaticName, code);
    }

    // render main
    const nodesToReplace: [{ start: number; end: number }, string][] = [...this.nodesToReplace];
    nodesToReplace.push(
      ...this.agg.moduleNodes.map((node) => {
        return [node, ''] as [acorn.Node, string];
      }),
    );
    let outMain = renderSkip(this.args.source, nodesToReplace);
    outMain += this.agg.mod.renderSource();

    return { main: outMain, static: outStatic };
  }
}

function renderSkip(raw: string, skip: Iterable<[{ start: number; end: number }, string]>): string {
  const replaces = [...skip];
  replaces.sort(([{ start: a }], [{ start: b }]) => a - b);

  let out = raw.substring(0, replaces.at(0)?.[0].start);
  for (let i = 0; i < replaces.length; ++i) {
    out += replaces[i][1];
    out += raw.substring(replaces[i][0].end, replaces.at(i + 1)?.[0].start);
  }
  return out;
}

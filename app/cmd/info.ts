import { aggregateImports } from '../../lib/internal/analyze/module.ts';
import { VarInfo, analyzeBlock } from '../../lib/internal/analyze/block.ts';
import { findVars, resolveConst } from '../../lib/interpret.ts';
import { createBlock } from '../../lib/internal/analyze/helper.ts';
import { loadAndMaybeTransform } from '../lib/load.ts';
import { relativize } from '../../lib/helper.ts';

export type InfoArgs = {
  path: string;
};

export default async function cmdInfo(args: InfoArgs) {
  const { p } = await loadAndMaybeTransform(args.path);

  const agg = aggregateImports(p);
  const block = createBlock(...agg.rest);
  const analysis = analyzeBlock(block);
  resolveConst(agg, analysis);

  const toplevelVars = new Map<string, VarInfo>();
  const nestedVars = new Map<string, VarInfo>();
  for (const [cand, info] of analysis.vars) {
    info.local && toplevelVars.set(cand, info);
    info.nested && nestedVars.set(cand, info);
  }
  const toplevelFind = findVars({ find: toplevelVars, vars: analysis.vars, mod: agg.mod });
  const nestedFind = findVars({ find: nestedVars, vars: analysis.vars, mod: agg.mod });

  console.info('#', JSON.stringify(relativize(args.path)));

  // TODO: not useful right now
  // const sideEffects = toplevelFind.immediateAccess;
  // console.info('\nSide-effects:', sideEffects ? 'Unknown' : 'No!');

  console.info('\nImports:');
  for (const { name, info } of agg.mod.importSources()) {
    console.info(`- ${JSON.stringify(name)}`);
    info.imports.forEach((names, remote) => {
      for (const name of names) {
        const left = name === remote ? name : `${remote || '*'} as ${name}`;
        console.info(`  - ${left}`);
      }
    });
  }

  console.info('\nExports:');
  for (const { name, info } of agg.mod.importSources()) {
    if (info.reexportAll) {
      console.info(`- * from ${JSON.stringify(name)}`);
    }
  }
  for (const e of agg.mod.exported()) {
    const left = e.exportedName === e.name ? e.name : `${e.name || '*'} as ${e.exportedName}`;
    let suffix = '';

    const lookup = agg.mod.lookupImport(e.name);
    if (lookup) {
      suffix = ` from ${JSON.stringify(lookup.import)}`;
    } else if (e.import) {
      suffix = ` from ${JSON.stringify(e.import)} (re-export)`;
    } else if (!agg.localConst.has(e.name)) {
      suffix = ` (mutable, may change)`;
    } else {
      suffix = ` (immutable)`;
    }
    console.info(`- ${left}${suffix}`);
  }

  console.info('\nGlobals used at top-level:');
  for (const [g, rw] of toplevelFind.globals) {
    console.info(`- ${g}${rw ? ' (written)' : ''}`);
  }

  console.info('\nImports used at top-level:');
  for (const g of toplevelFind.imports.keys()) {
    console.info(`- ${g}`);
  }

  console.info('\nGlobals used in callables:');
  for (const [g, rw] of nestedFind.globals) {
    console.info(`- ${g}${rw ? ' (written)' : ''}`);
  }

  console.info('\nImports used in callables:');
  for (const g of nestedFind.imports.keys()) {
    console.info(`- ${g}`);
  }
}

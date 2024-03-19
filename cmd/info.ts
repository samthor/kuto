import * as fs from 'node:fs';
import * as path from 'node:path';
import * as acorn from 'acorn';
import { aggregateImports } from '../lib/internal/module.ts';
import { VarInfo, analyzeBlock, createBlock } from '../lib/internal/analyze.ts';
import { findVars, resolveConst } from '../lib/interpret.ts';
import { relativize } from '../lib/helper.ts';

export type InfoArgs = {
  path: string;
};

const needsBuildExt = (ext: string) => ['.ts', '.tsx', '.jsx'].includes(ext);

export default async function cmdInfo(args: InfoArgs) {
  const { ext } = path.parse(args.path);
  let source = fs.readFileSync(args.path, 'utf-8');

  // lazily compile with esbuild (throws if not available)
  if (needsBuildExt(ext)) {
    const esbuild = await import('esbuild');
    const t = esbuild.transformSync(source, {
      loader: ext.endsWith('x') ? 'tsx' : 'ts',
      format: 'esm',
      platform: 'neutral',
    });
    source = t.code;
  }

  const p = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });

  const agg = aggregateImports(p);
  const block = createBlock(...agg.rest);
  const analysis = analyzeBlock(block);
  resolveConst(agg, analysis);

  const toplevelVars = new Map<string, VarInfo>();
  for (const [cand, info] of analysis.vars) {
    if (info.local) {
      toplevelVars.set(cand, info);
    }
  }
  const toplevelFind = findVars({ find: toplevelVars, vars: analysis.vars, mod: agg.mod });

  console.info('#', JSON.stringify(relativize(args.path)));

  console.info('\nExports:');
  for (const e of agg.mod.exported()) {
    const left = e.exportedName === e.name ? e.name : `${e.exportedName}: ${e.name}`;
    let suffix = '';
    if (e.import) {
      suffix = ` (from ${JSON.stringify(e.import)})`;
    } else if (!agg.localConst.has(e.name)) {
      suffix = ` (mutable, needs bind)`;
    }
    console.info(`- ${left}${suffix}`);
  }

  console.info('\nGlobals used at top-level:');
  for (const [g, rw] of toplevelFind.globals) {
    console.info(`- ${g}${rw ? ' (written)' : ''}`);
  }

  // for (const [v, info] of analysis.vars) {
  //   console.info(v, '=>', info);
  // }
}

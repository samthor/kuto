import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildJoin, urlAgnosticRelativeBasename } from '../lib/helper.ts';
import { aggregateImports } from '../../lib/internal/analyze/module.ts';
import * as acorn from 'acorn';

export function parse(source: string) {
  return acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
}

function hasCorpusSuffix(s: string) {
  return /\.kt-\w+.js$/.test(s);
}

export type LoadExistingArgs = {
  from: string;
  keep: number;
};

function isDir(s: fs.PathLike) {
  try {
    const stat = fs.statSync(s);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function loadSource(s: string) {
  if (s.startsWith('https://') || s.startsWith('http://')) {
    const r = await fetch(s);
    if (!r.ok) {
      throw new Error(
        `couldn't fetch old source from ${JSON.stringify(s)}: ${r.status} ${r.statusText}`,
      );
    }
    return r.text();
  }

  return fs.readFileSync(s, 'utf-8');
}

export async function loadExisting(args: LoadExistingArgs) {
  let cand: string[];

  if (isDir(args.from)) {
    cand = fs.readdirSync(args.from).map((c) => path.join(args.from, c));
  } else {
    const text = await loadSource(args.from);
    const join = buildJoin(args.from);

    const p = parse(text);
    const agg = aggregateImports(p);

    cand = [...agg.mod.importSources()].map(({ name }) => join(name));
    cand.unshift(args.from);
  }

  const load = cand.filter((x) => hasCorpusSuffix(x));

  const existing = await Promise.all(
    load.map(async (name) => {
      const text = await loadSource(name);
      return { name: urlAgnosticRelativeBasename(name), text, skip: true };
    }),
  );

  // keep the top-n largest static bundles
  const existingBySize = existing.sort(({ text: a }, { text: b }) => b.length - a.length);
  const keepN = Math.min(args.keep, existingBySize.length);
  for (let i = 0; i < keepN; ++i) {
    existingBySize[i].skip = false;
  }

  // load
  const out = new Map<string, string>();
  const prior = new Set<string>();
  for (const e of existing) {
    if (!e.skip) {
      if (out.has(e.name)) {
        throw new Error(`duplicate corpus: ${e.name}`);
      }
      out.set(e.name, e.text);
    }
    prior.add(e.name);
  }

  return { existingStaticSource: out, prior: [...prior] };
}

const needsBuildExt = (ext: string) => ['.ts', '.tsx', '.jsx'].includes(ext);

export async function loadAndMaybeTransform(name: string) {
  const { ext } = path.parse(name);
  let source = fs.readFileSync(name, 'utf-8');
  const stat = fs.statSync(name);

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

  const p = parse(source);
  return { p, name, source, stat };
}

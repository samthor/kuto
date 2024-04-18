import { buildResolver } from 'esm-resolve';
import { LoadResult, loadAndMaybeTransform, parse } from '../lib/load.ts';
import { aggregateImports } from '../../lib/internal/analyze/module.ts';
import * as path from 'node:path';
import { isLocalImport, relativize } from '../../lib/helper.ts';

export type ValidArgs = {
  paths: string[];
};

type FoundInfo = {
  importer: string[];
  tags?: { local?: string[]; nested?: string[] };
  found?: boolean;
};

const matchTag = /@kuto-(\w+)/g;

export default async function cmdGraph(args: ValidArgs) {
  const pending = new Set<string>();
  const mod: Record<string, FoundInfo> = {};

  for (const raw of args.paths) {
    const entrypoint = relativize(raw);
    pending.add(entrypoint);
    mod[entrypoint] = { importer: [] };
  }

  for (const p of pending) {
    pending.delete(p);
    if (!isLocalImport(p)) {
      continue; // rn we ignore "foo"
    }

    const info = mod[p]!;

    let x: LoadResult;
    try {
      x = await loadAndMaybeTransform(p);
    } catch (e) {
      info.found = false;
      continue;
    }
    info.found = true;
    const prog = parse(x.source, (comment) => {
      comment.replaceAll(matchTag, (_, tag) => {
        info.tags ??= {};
        info.tags.local ??= [];
        if (!info.tags.local.includes(tag)) {
          info.tags.local.push(tag);
        }
        return '';
      });
    });

    // -- resolve additional imports

    const resolver = buildResolver(p, {
      allowImportingExtraExtensions: true,
      resolveToAbsolute: true,
    });

    const imports = aggregateImports(prog);

    const resolved: string[] = [];
    for (const source of imports.mod.importSources()) {
      let key = source.name;

      if (isLocalImport(source.name)) {
        const r = resolver(source.name);
        if (!r) {
          continue;
        }
        key = relativize(path.relative(process.cwd(), r));
        resolved.push(key);
      }

      // create graph to thingo
      const prev = mod[key];
      if (prev !== undefined) {
        prev.importer.push(p);
      } else {
        mod[key] = { importer: [p] };
        pending.add(key);
      }
    }
  }

  // descend tags

  const expandTree = (key: string) => {
    const all = new Set<string>();
    const pending = [key];

    while (pending.length) {
      const next = pending.pop()!;
      all.add(next);

      for (const importer of mod[next].importer) {
        if (all.has(importer)) {
          continue;
        }
        pending.push(importer);
      }
    }

    all.delete(key);
    return [...all];
  };

  for (const key of Object.keys(mod)) {
    const o = mod[key];
    const tree = expandTree(key);

    for (const localTag of o.tags?.local ?? []) {
      for (const okey of tree) {
        const o = mod[okey];
        o.tags ??= {};
        o.tags.nested ??= [];
        if (!o.tags.nested.includes(localTag)) {
          o.tags.nested.push(localTag);
        }
      }
    }
  }

  const out = {
    mod,
  };
  console.info(JSON.stringify(out, undefined, 2));
}

import * as fs from 'node:fs';
import * as path from 'node:path';
import { StaticExtractor } from '../../lib/extractor.ts';
import { liftDefault } from '../../lib/lift.ts';
import { loadAndMaybeTransform, parse } from '../lib/load.ts';
import { loadExisting } from '../lib/load.ts';
import { relativize } from '../../lib/helper.ts';
import { buildCorpusName } from '../../lib/name.ts';

export type SpiltArgs = {
  min: number;
  keep: number;
  sourcePath: string;
  oldPath: string;
  dist: string;
  dedupCallables: boolean;
  basename: string;
};

export default async function cmdSplit(args: SpiltArgs) {
  const { sourcePath, dist } = args;

  fs.mkdirSync(dist, { recursive: true });

  const name = path.parse(args.basename || sourcePath).name + '.js';
  const sourceName = relativize(name);
  const staticName = relativize(buildCorpusName(name));

  const existing = await loadExisting({
    from: args.oldPath || args.dist,
    keep: args.keep,
  });

  const { source } = await loadAndMaybeTransform(args.sourcePath);
  const prog = parse(source);

  const e = new StaticExtractor({
    p: prog,
    source,
    sourceName,
    staticName,
    existingStaticSource: existing.existingStaticSource,
    dedupCallables: args.dedupCallables,
  });
  const liftStats = liftDefault(e, args.min);

  // run
  const out = e.build();
  const disused = existing.prior.filter((name) => !out.static.has(name));

  // generate stats, show most recent first
  const sizes: Record<string, number> = {};
  sizes[sourceName] = out.main.length;
  let totalSize = out.main.length;
  const statics = [...out.static].sort(([a], [b]) => b.localeCompare(a));
  statics.forEach(([name, code]) => {
    sizes[name] = code.length;
    totalSize += code.length;
  });

  console.info('stats', {
    source: { size: source.length },
    sizes,
    disused,
    lift: liftStats,
  });
  console.info('overhead:', toPercentChange(totalSize / source.length));

  // write new files, nuke old ones IF they're in the output dir
  for (const name of disused) {
    try {
      fs.rmSync(path.join(dist, name));
    } catch {}
  }
  fs.writeFileSync(path.join(dist, sourceName), out.main);
  for (const [name, code] of out.static) {
    fs.writeFileSync(path.join(dist, name), code);
  }

  console.info('Ok!');
}

const toPercentChange = (v: number) => {
  const sign = v < 1.0 ? '' : '+';
  return sign + ((v - 1.0) * 100).toFixed(1) + '%';
};

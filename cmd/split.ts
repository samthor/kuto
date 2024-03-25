import * as fs from 'node:fs';
import * as path from 'node:path';
import { StaticExtractor } from '../lib/extractor.ts';
import { liftDefault } from '../lib/lift.ts';
import { loadExisting } from '../lib/bin.ts';
import { loadAndMaybeTransform } from '../lib/load.ts';
import { isUrl, relativize } from '../lib/helper.ts';

const startOfTime = 1710925200000; // 2024-03-24 20:00 SYD time

export type SpiltArgs = {
  min: number;
  keep: number;
  sourcePath: string;
  oldPath: string;
  dist: string;
  dedupCallables: boolean;
};

export default async function cmdSplit(args: SpiltArgs) {
  const { sourcePath, dist } = args;

  fs.mkdirSync(dist, { recursive: true });

  // it doesn't matter what base this is, or what number it is; later runs 'prefer' files sorted earlier
  const key = toBase62(+new Date() - startOfTime, 7);

  const parts = path.parse(sourcePath);
  const sourceName = relativize(parts.base);
  const staticName = relativize(parts.name + `.kt-${key}.js`);

  const existing = await loadExisting({
    from: args.oldPath || args.dist,
    keep: args.keep,
  });

  const { p, source } = await loadAndMaybeTransform(args.sourcePath);

  const e = new StaticExtractor({
    p,
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

function toBase62(v: number, pad: number = 0) {
  const b62digit = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  while (v > 0) {
    result = b62digit[v % b62digit.length] + result;
    v = Math.floor(v / b62digit.length);
  }
  return result.padStart(pad, '0');
}

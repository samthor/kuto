import * as fs from 'node:fs';
import * as path from 'node:path';
import { StaticExtractor } from '../lib/extractor.ts';
import { liftDefault } from '../lib/lift.ts';
import { loadExisting } from '../lib/bin.ts';
import { loadAndMaybeTransform } from '../lib/load.ts';

const startOfTime = 1710925200000; // 2024-03-24 20:00 SYD time

export type SpiltArgs = {
  min: number;
  keep: number;
  sourcePath: string;
  dist: string;
  dedupCallables: boolean;
};

export default async function cmdSplit(args: SpiltArgs) {
  const { sourcePath, dist } = args;

  fs.mkdirSync(dist, { recursive: true });

  // it doesn't matter what base this is, or what number it is; later runs 'prefer' files sorted earlier
  const key = toBase62(+new Date() - startOfTime, 7);

  const parts = path.parse(sourcePath);
  const sourceName = parts.base;
  const staticName = parts.name + `.kt-${key}.js`;

  const existing = loadExisting(args);

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
  const toRemove = existing.cand.filter((e) => !out.static.has(e));

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
    remove: toRemove,
    lift: liftStats,
  });
  console.info('overhead:', toPercentChange(totalSize / source.length));

  // write new files, nuke old ones
  for (const e of toRemove) {
    fs.rmSync(path.join(dist, e));
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


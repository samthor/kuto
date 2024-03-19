import * as fs from 'node:fs';
import * as path from 'node:path';
import { StaticExtractor } from '../lib/extractor.ts';
import { liftDefault } from '../lib/lift.ts';
import { loadExisting } from '../lib/bin.ts';

export type SpiltArgs = {
  min: number;
  keep: number;
  sourcePath: string;
  dist: string;
};

export default async function cmdSplit(args: SpiltArgs) {
  const { sourcePath, dist } = args;

  const source = fs.readFileSync(sourcePath, 'utf-8');
  fs.mkdirSync(dist, { recursive: true });

  const now = +new Date();

  const parts = path.parse(sourcePath);
  const sourceName = parts.base;
  const staticName = parts.name + `.sjs-${now.toString(36).padStart(8, '0')}.js`;

  const existing = loadExisting(args);

  const e = new StaticExtractor({
    source,
    sourceName,
    staticName,
    existingStaticSource: existing.existingStaticSource,
  });
  const liftStats = liftDefault(e, args.min);

  // run
  const out = e.build();
  const toRemove = existing.cand.filter((e) => !out.static.has(e));

  // generate stats, show most recent first
  const sizes: Record<string, number> = {};
  sizes[sourceName] = out.main.length;
  const statics = [...out.static].sort(([a], [b]) => b.localeCompare(a));
  statics.forEach(([name, code]) => (sizes[name] = code.length));

  console.info('stats', {
    source: { size: source.length },
    sizes,
    remove: toRemove,
    lift: liftStats,
  });

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

import * as fs from 'node:fs';
import * as path from 'node:path';
import { ExtractStaticArgs, StaticExtractor } from './lib/extractor.ts';
import { liftDefault } from './lib/lift.ts';

const MIN_SIZE = 32;
const dist = 'dist';

fs.mkdirSync(dist, { recursive: true });

const p = process.argv[2];
const source = fs.readFileSync(p, 'utf-8');

const now = +new Date();

const parts = path.parse(p);
const sourceName = parts.base;
const staticName = parts.name + `.sjs-${now.toString(36).padStart(8, '0')}.js`;

const args: ExtractStaticArgs = {
  source,
  sourceName,
  staticName,
  existingStaticSource: new Map(),
};
const existing = fs
  .readdirSync(dist)
  .filter((x) => /\.sjs-\w+.js$/.test(x))
  .toReversed(); // prefer latest first
for (const e of existing) {
  args.existingStaticSource.set(e, fs.readFileSync(path.join(dist, e), 'utf-8'));
}

const e = new StaticExtractor(args);
liftDefault(e, MIN_SIZE);

// run
const out = e.build();
const toRemove = existing.filter((e) => !out.static.has(e));

// generate stats, show most recent first
const sizes: Record<string, number> = {};
sizes[sourceName] = out.main.length;
const statics = [...out.static].sort(([a], [b]) => b.localeCompare(a));
statics.forEach(([name, code]) => (sizes[name] = code.length));

console.info('stats', {
  source: { size: source.length },
  sizes,
  remove: toRemove,
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

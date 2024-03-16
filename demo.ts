import * as fs from 'node:fs';
import * as path from 'node:path';
import { ExtractStaticArgs, extractStatic } from './lib/extract.ts';

const dist = 'dist';

fs.mkdirSync(dist, { recursive: true });

const p = process.argv[2];
const source = fs.readFileSync(p, 'utf-8');

const now = +new Date();

const parts = path.parse(p);
const sourceName = './' + parts.base;
const staticName = './' + parts.name + `.sjs-${now.toString(36).padStart(8, '0')}.js`;

const args: ExtractStaticArgs = { source, sourceName, staticName, existingStaticSource: new Map() };
const existing = fs
  .readdirSync(dist)
  .filter((x) => /\.sjs-\w+.js$/.test(x))
  .toReversed(); // prefer latest first
for (const e of existing) {
  args.existingStaticSource.set(e, fs.readFileSync(path.join(dist, e), 'utf-8'));
}

const out = extractStatic(args);

fs.writeFileSync(path.join(dist, sourceName), out.source.main);

for (const [name, info] of out.source.static) {
  fs.writeFileSync(path.join(dist, name), info);
}

console.info('Ok');

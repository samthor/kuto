import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseArgs } from 'node:util';
import { ExtractStaticArgs, StaticExtractor } from './lib/extractor.ts';
import { liftDefault } from './lib/lift.ts';
import { loadExisting } from './lib/bin.ts';

const argsRaw = parseArgs({
  options: {
    min: {
      type: 'string',
      default: '32',
      short: 'm',
    },
    keep: {
      type: 'string',
      default: '4',
      short: 'k',
    },
    help: {
      type: 'boolean',
      default: false,
    },
  },
  allowPositionals: true,
});

const argsValues = {
  min: +(argsRaw.values['min'] ?? 0),
  keep: +(argsRaw.values['keep'] ?? 0),
};

if (argsRaw.values.help || argsRaw.positionals.length !== 2) {
  const helpMessage = `usage: kuto <source> <outdir/>

   --min, -m (default 32):           only staticify nodes larger than this
   --keep, -k (default 4):           always keep this many top-sized static bundle(s)

more info: https://kuto.dev`;
  console.warn(helpMessage);
  process.exit(1);
}

const sourcePath = argsRaw.positionals[0];
const source = fs.readFileSync(sourcePath, 'utf-8');
const dist = argsRaw.positionals[1];
fs.mkdirSync(dist, { recursive: true });

const now = +new Date();

const parts = path.parse(sourcePath);
const sourceName = parts.base;
const staticName = parts.name + `.sjs-${now.toString(36).padStart(8, '0')}.js`;

const existing = loadExisting({ dist, ...argsValues });
const args: ExtractStaticArgs = {
  source,
  sourceName,
  staticName,
  existingStaticSource: existing.existingStaticSource,
};

const e = new StaticExtractor(args);
const liftStats = liftDefault(e, argsValues.min);

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

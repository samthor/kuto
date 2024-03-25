import * as fs from 'node:fs';
import * as path from 'node:path';
import { relativize } from './helper.ts';

const dec = new TextDecoder();

export type LoadExistingArgs = {
  dist: string;
  keep: number;
};

export function loadExisting(args: LoadExistingArgs) {
  const existing = fs
    .readdirSync(args.dist)
    .filter((x) => /\.kt-\w+.js$/.test(x))
    .toReversed() // prefer latest first
    .map((name) => {
      const bytes = fs.readFileSync(path.join(args.dist, name));
      const text = dec.decode(bytes);
      return { name: relativize(name), bytes, text, skip: true };
    });

  // keep the top-n largest static bundles
  const existingBySize = existing.sort(({ bytes: a }, { bytes: b }) => b.length - a.length);
  const keepN = Math.min(args.keep, existingBySize.length);
  for (let i = 0; i < keepN; ++i) {
    existingBySize[i].skip = false;
  }

  // load
  const out = new Map<string, string>();
  for (const e of existing) {
    if (e.skip) {
      continue;
    }
    out.set(e.name, e.text);
  }

  return { existingStaticSource: out, cand: existing.map(({ name }) => name) };
}

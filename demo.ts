import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractStatic } from './lib/extract.ts';

const p = process.argv[2];
const raw = fs.readFileSync(p, 'utf-8');

const parts = path.parse(p);
const sourceName = './' + parts.base;
const staticName = './' + parts.name + '.static.js';

const out = extractStatic(raw, { sourceName, staticName });
console.info(out);

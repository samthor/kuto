import * as acorn from 'acorn';
import * as fs from 'node:fs';
import { analyzeProgram } from './lib/analyze.ts';

const raw = fs.readFileSync(process.argv[2], 'utf-8');

const p = acorn.parse(raw, {
  ecmaVersion: 'latest',
  sourceType: 'module',
});

const out = analyzeProgram(p);
console.info(out);

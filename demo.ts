import * as acorn from 'acorn';
import * as fs from 'node:fs';
import { analyzeBlock, createBlock } from './lib/internal/analyze.ts';

const raw = fs.readFileSync(process.argv[2], 'utf-8');

const p = acorn.parse(raw, {
  ecmaVersion: 'latest',
});

// TODO: strip export/import properly

const body: acorn.Statement[] = [];

for (const node of p.body) {
  switch (node.type) {
    case 'ImportDeclaration':
    case 'ExportNamedDeclaration':
    case 'ExportDefaultDeclaration':
    case 'ExportAllDeclaration':
      continue;

    default:
      body.push(node);
  }
}

const out = analyzeBlock(createBlock(...body));

console.info(out);

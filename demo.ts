import * as fs from 'node:fs';
import * as path from 'node:path';
import { ExtractStaticArgs, StaticExtractor } from './lib/extractor.ts';
import type * as acorn from 'acorn';

const dist = 'dist';

fs.mkdirSync(dist, { recursive: true });

const p = process.argv[2];
const source = fs.readFileSync(p, 'utf-8');

const now = +new Date();

const parts = path.parse(p);
const sourceName = './' + parts.base;
const staticName = './' + parts.name + `.sjs-${now.toString(36).padStart(8, '0')}.js`;

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

for (const part of e.block.body) {
  if (part.type !== 'FunctionDeclaration') {
    continue;
  }
  e.liftFunctionDeclaration(part);
}

const maybeLiftExpr: acorn.Expression[] = [
  ...(e.block.body
    .map((s) =>
      s.type === 'ExpressionStatement' && s.expression.type === 'AssignmentExpression'
        ? s.expression.right
        : null,
    )
    .filter((x) => x !== null) as acorn.FunctionExpression[]),
  ...(e.block.body
    .map((s) => (s.type === 'VariableDeclaration' ? s.declarations.map((d) => d.init) : []))
    .flat()
    .filter((x) => x !== null) as acorn.Expression[]),
];
for (const expr of maybeLiftExpr) {
  e.liftExpression(expr);
}

const out = e.build();
const toRemove = existing.filter((e) => !out.static.has(e));

const sizes: Record<string, number> = {};
sizes[sourceName] = out.main.length;
out.static.forEach((code, name) => (sizes[name] = code.length));

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

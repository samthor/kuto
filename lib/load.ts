import * as fs from 'node:fs';
import * as path from 'node:path';
import * as acorn from 'acorn';

const needsBuildExt = (ext: string) => ['.ts', '.tsx', '.jsx'].includes(ext);

export async function loadAndMaybeTransform(name: string) {
  const { ext } = path.parse(name);
  let source = fs.readFileSync(name, 'utf-8');

  // lazily compile with esbuild (throws if not available)
  if (needsBuildExt(ext)) {
    const esbuild = await import('esbuild');
    const t = esbuild.transformSync(source, {
      loader: ext.endsWith('x') ? 'tsx' : 'ts',
      format: 'esm',
      platform: 'neutral',
    });
    source = t.code;
  }

  const p = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  return { p, name, source };
}

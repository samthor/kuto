import * as path from 'node:path';
import * as url from 'node:url';
import * as fs from 'node:fs';
import { $ } from 'zx';
import * as process from 'node:process';

const dir = path.dirname(url.fileURLToPath(new URL(import.meta.url)));
process.chdir(dir);

// #1: run simple test cases; these just confirm they can compile once, and run

const casesDir = 'test/cases';
try {
  fs.rmSync('dist/', { recursive: true });
} catch { }

const errors: string[] = [];
const cases = fs.readdirSync(casesDir).filter((x) => x.endsWith('.js')).toSorted();
for (const caseToRun of cases) {
  const { name } = path.parse(caseToRun);
  console.info('#', name);

  // strip any trailing number: test "foo2" will run after "foo1"
  const soloName = name.replace(/\d+$/, '');

  try {
    const script = path.join(casesDir, caseToRun);
    await $`npx tsx app.ts split ${script} dist/${soloName} -n index`;
    await $`node dist/${soloName}/index.js`;
  } catch {
    errors.push(caseToRun);
  }

  console.info();
}

console.info(cases.length - errors.length + '/' + cases.length, 'passed');

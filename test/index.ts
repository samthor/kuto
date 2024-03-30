import { $ } from 'zx';
import * as path from 'node:path';
import * as url from 'node:url';
import * as fs from 'node:fs';
import * as process from 'node:process';

const dir = path.dirname(url.fileURLToPath(new URL(import.meta.url)));
process.chdir(dir);

// #1: run simple test cases; these just confirm they can compile once, and run

const casesDir = 'cases';
try {
  fs.rmSync('dist/', { recursive: true });
} catch { }

let lastSoloFailure: string = '';

const errors: string[] = [];
const cases = fs.readdirSync(casesDir).filter((x) => x.endsWith('.js')).toSorted();
for (const caseToRun of cases) {
  const { name } = path.parse(caseToRun);

  // strip any trailing number: test "foo2" will run after "foo1"
  const soloName = name.replace(/\d+$/, '');
  try {
    if (soloName === lastSoloFailure) {
      continue;
    }
  } finally {
    lastSoloFailure = '';
  }
  console.info('#', name);

  try {
    const script = path.join('test', casesDir, caseToRun);
    await $`npx tsx ./app split ${script} test/dist/${soloName} -n index`;
    await $`node test/dist/${soloName}/index.js`;
  } catch {
    errors.push(caseToRun);
    lastSoloFailure = soloName;
  }

  console.info();
}

console.info(cases.length - errors.length + '/' + cases.length, 'passed');

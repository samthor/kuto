import { $ } from 'zx';
import * as path from 'node:path';
import * as url from 'node:url';
import * as fs from 'node:fs';
import * as process from 'node:process';

const dir = path.dirname(url.fileURLToPath(new URL(import.meta.url)));
process.chdir(dir);

const onlyRun = process.argv.slice(2);

// #1: run simple test cases; these just confirm they can compile once, and run

const casesDir = 'cases';
try {
  fs.rmSync('dist/', { recursive: true });
} catch {}

let lastSoloFailure: string = '';

const success: string[] = [];
const errors: string[] = [];
const cases = fs
  .readdirSync(casesDir)
  .filter((x) => x.endsWith('.js'))
  .toSorted();
for (const caseToRun of cases) {
  const { name } = path.parse(caseToRun);

  // strip any trailing number: test "foo2" will run after "foo1"
  const soloName = name.replace(/\d+$/, '');
  if (onlyRun.length && !onlyRun.includes(soloName)) {
    continue;
  }

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
    success.push(caseToRun);
  } catch {
    errors.push(caseToRun);
    lastSoloFailure = soloName;
  }

  console.info();
}

const total = success.length + errors.length;
if (total === 0) {
  console.warn('no tests matched');
  process.exit(2); // no test run
}
console.info(success.length + '/' + total, 'passed');
if (errors.length) {
  process.exit(1);
}

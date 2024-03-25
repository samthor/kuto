import * as path from 'node:path';
import * as url from 'node:url';
import * as fs from 'node:fs';
import { $ } from 'zx';
import * as process from 'node:process';

const dir = path.dirname(url.fileURLToPath(new URL(import.meta.url)));
process.chdir(dir);

// #1: run simple test cases; these just confirm they can compile once, and run

const casesDir = 'test/cases';
fs.rmSync('dist/', { recursive: true });

const errors: string[] = [];
const cases = fs.readdirSync(casesDir).filter((x) => x.endsWith('.js'));
for (const caseToRun of cases) {
  const { name } = path.parse(caseToRun);
  console.info('#', name);

  try {
    const script = path.join(casesDir, caseToRun);
    await $`npx tsx app.ts split ${script} dist/${name}`;
    await $`node dist/${name}/${caseToRun}`;
  } catch {
    errors.push(caseToRun);
  }

  console.info();
}

console.info(cases.length - errors.length + '/' + cases.length, 'passed');

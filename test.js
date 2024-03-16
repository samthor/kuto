import { fromImport as localImport } from 'other-file';
import { fromImport as localImport2 } from 'other-file';
export { localImport as somethingElse };
export { throughImport } from 'somewhere-file';
import * as whatever from 'blah';

var foo;

function cannotYeet() {
  foo = 123;
}

function canYeet() {
  cannotYeet();
  localImport();
  localImport2();
  console.info(foo);
}

export function exportedSomething() {
  canYeet();
}

export { exportedSomething as exportedSomethingExtra };

canYeet();

var alwaysConst = 123;
export { alwaysConst as alwaysConstExported };

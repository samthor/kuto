export {};

import { fromImport as localImport } from 'other-file';
export { localImport };

export { throughImport } from 'somewhere-file';

// // var naked;

// (function () {
//   foo = 123;
// })();

// class Blah {
//   static {
//     zing = 123;
//   }
// }

// function unknown() {
//   zing = 12312341;
// }

//var x = zing;

var foo;

function cannotYeet() {
  foo = 123;
}

function canYeet() {
  console.info(foo);
}

function somethingElse() {
  canYeet();
}

export { foo };

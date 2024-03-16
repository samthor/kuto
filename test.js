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

const foo = 123;

{
  x = 123;
  var x;
}

+function () {
  foo = 123;
};

function Foo() {
  const c = new AbortController();
  c.abort();
  return c.signal;
}

export function Bar() {}
export const ConstFunctionExpression = () => {};

export { ConstFunctionExpression as RenamedConstFunctionExpression };

// iife allows change but still 'const' - can't run again
(() => {
  Bar = () => {};
})();

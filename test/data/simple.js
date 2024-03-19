class Foo {
  x = new Set();
}

import { somdfas as x2 } from 'other-file';

//x2;

() => {
  console.info(x2);
};

export { x2 as y4 };

export * from 'something';

export function foo() {}

//foo = 123;

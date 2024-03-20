class Foo {
  x = new Set();

  static y = new Map();
}

const out =
  void 1 +
  (() => {
    globalIifeUse();
  })();

import { somdfas as x2 } from 'other-file';

//x2;

() => {
  // console.info(x2);
};

export { x2 as y4 };

export * from 'something';

export function foo() {}

//foo = 123;

const clone = x2;

export { x2, clone };

import { fasfa as whatever } from 'whatever-file';
// export { y4 };

export { whatever };

export { direct } from 'somethingelse-direct';

export { foo as bar };

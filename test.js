let x = 123;

export function foo() {
  ++x;
}

function bar() {
  return x + 1;
}

function bar2() {
  return x + 2;
}

foo();
bar();
bar2();
console.info('bar', bar());

function whatever() {
  if (1) {
    if (somethingElse()) {
      throw 123;
    }
  }
}

function somethingElse() {
  return 123;
}

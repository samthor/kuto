let x = 123;

export function foo() {
  ++x;
}

function bar() {
  return x;
}

function bar2() {
  return x + 2;
}

foo();
bar();
bar2();
console.info('bar', bar());

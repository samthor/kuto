let x = 123;

export function foo() {
  ++x;
}

function bar() {
  return x;
}

foo();
bar();
console.info('bar', bar());

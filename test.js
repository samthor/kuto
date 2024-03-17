function foo() {
  console.info('hello there');
}

foo();

let whatever = {};

whatever.func = function () {
  return 'A function lol that is set on an object';
};

export { whatever };

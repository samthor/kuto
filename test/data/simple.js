// let y = 123;
// (function foo() {
//   console.info('this function is really long now helo whatever', y);
// })();

// let consoleTest = console.info('butts') + 1234;

// const foo = function () {
//   console.info('this function is really long now helo whatever', y);
//   console.info('this function is really long now helo whatever', y);
//   console.info('this function is really long now helo whatever', y);
//   console.info('this function is really long now helo whatever', y);
//   console.info('this function is really long now helo whatever', y);
// };

// const complex =
//   foo() + foo() + foo() + foo() + foo() + foo() + foo() + foo() + foo() + foo() + foo() + foo();

// export { complex };

// var keywordRelationalOperator =
//   /^in(stanceof SUPER LOASDFDASFDSAFADSFJK ASDJFLKSDA JFLDSKAF JLADSKFJ SADLKFJ ALSDKF JSADLKF JADSKL FJASD sadf dsaf a)?$/;

// function whatever() {
//   keywordRelationalOperator.test('asdfdasfdsafadsfadsfadsfasdfadsfafasddfasd');
// }

// const foo_shouldfail = ('longexpr', 'longexpr2', console.info('test'));

const localValue = 123;

(function iife() {
  console.info(
    'This is a really, really really really long expression that references',
    localValue,
  );
})();

function test() {
  return localValue * 100000;
}

console.info('output is now', test());

console.info('test'), console.warn('bar'), test();

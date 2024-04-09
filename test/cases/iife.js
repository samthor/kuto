function something_long_call() {}
const foo = { bar() {} };

(function (q) {
  console.info('Kuto should extract this long statement', q);
  something_long_call(123, 'hello there long');
  foo.bar(q);
})();

if (1) {
  var x = 123;
  console.info('long statement that uses inner var', x);
  console.info('long statement that is otherwise boring AF');
}

if (1) console.info('long thing that can be yeetyed');

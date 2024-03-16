export {};

// var naked;

function foo(x = 123) {
  zing++;
}

var x = {
  y: function () {
    void function () {
      //      foo = function (x = 345) {};
      foo();
    };
  },
};

import('foo');

import.meta['whatever'];

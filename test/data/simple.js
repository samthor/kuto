
b();

function a() {
  console.info('a has changed');
}

function b() {
  console.info('b');
  a();
}

b();


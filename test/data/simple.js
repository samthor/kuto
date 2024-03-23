
b();

function a() {
  console.info('a has additionally changed');
}

function b() {
  console.info('b');
  a();
}

b();


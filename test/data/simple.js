
b();

function a() {
  console.info('a has additionally changed');
}

console.info('does complex thing lollololol');

function b() {
  console.info('b');
  a();
}

b();



b();

function a() {
  console.info('a has additionally changed');
}

console.info('does complex thing lollololol');
console.info('does complex thing lollololol');

const x = () => {
  console.info('same');
};
const y = () => {
  console.info('same');
};

function b() {
  console.info('b');
  a();
}

b();

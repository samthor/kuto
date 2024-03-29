export default function xxx() {
  console.info('This is inside a default fn that is complex');
}

foo();

export function foo() {
  console.info('This will not change between default1 and default2');
} 
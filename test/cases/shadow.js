const a = () => 'Something long defined with `a`';

const b = () => 'Something long defined with `b`';

// we need to export real `b` as well; can Kuto work around this?
export { a as b };

const useB = 'Something long that _uses_ `b`: ' + b();

export { useB };

console.info(useB);
console.info('Ok');

// vars typically used by Kuto
export const _1 = '';
export const $1 = '';

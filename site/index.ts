import { DemoKutoElement } from './demo-kuto.ts';

const kd = new DemoKutoElement();
document.body.append(kd);

kd.value = `const A = () => 'something that is interesting but when exported, shadows a local';

const B = 'something else that is very lonfg hahaha';

console.info('this is a long statement that uses B', { B });

export { A as B };

const _1 = 'Lol shadow Kuto vars';

console.info('YET another long statement that uses', { B, _1 });
console.info(_1);
`;

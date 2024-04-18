//export let x = 123;

import * as Something from './somewhere-else';
import { Foo } from 'bar';

Something();

export function foo() {}

function x() {
  Something();
  {
    Foo.bar++;
  }
}

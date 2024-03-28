const startOfTime = 1710925200000; // 2024-03-24 20:00 SYD time

export function buildCorpusName(sourceName: string, now = new Date()) {
  const v = +now - startOfTime;
  if (v <= 0) {
    throw new Error(`in past`);
  }
  // it doesn't matter what base this is, or what number it is; later runs 'prefer' files sorted earlier
  const key = toBase62(v, 7);
  const suffix = `.kt-${key}.js`;

  const out = sourceName.replace(/\.js$/, suffix);
  if (!out.endsWith(suffix)) {
    throw new Error(`couldn't convert source name: ${sourceName}`);
  }
  return out;
}

export function toBase62(v: number, pad: number = 0) {
  const b62digit = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  while (v > 0) {
    result = b62digit[v % b62digit.length] + result;
    v = Math.floor(v / b62digit.length);
  }
  return result.padStart(pad, '0');
}

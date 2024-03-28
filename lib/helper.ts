export function withDefault<K, V>(m: Map<K, V>, k: K, build: (k: K) => V): V {
  if (m.has(k)) {
    return m.get(k)!;
  }
  const update = build(k);
  m.set(k, update);
  return update;
}

export function relativize(s: string) {
  if (s.startsWith('./') || s.startsWith('../')) {
    return s;
  }
  try {
    new URL(s);
    return s;
  } catch (e) {}
  return './' + s;
}

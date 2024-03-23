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
  } catch (e) { }
  return './' + s;
}

export function renderSkip(
  raw: string,
  skip: Iterable<{ start: number; end: number; replace?: string }>,
): string {
  const replaces = [...skip].toSorted(({ start: a }, { start: b }) => a - b);

  let out = raw.substring(0, replaces.at(0)?.start);
  for (let i = 0; i < replaces.length; ++i) {
    if (replaces[i].replace !== undefined) {
      out += replaces[i].replace;
    }
    const part = raw.substring(replaces[i].end, replaces.at(i + 1)?.start);
    out += part;
  }
  return out;
}

export function renderOnly(raw: string, include: { start: number; end: number }[]) {
  include = include.toSorted(({ start: a }, { start: b }) => a - b);

  const holes: { start: number; end: number }[] = [];

  let lastEnd = 0;
  const out = include
    .map(({ start, end }) => {
      if (lastEnd < start) {
        holes.push({ start: lastEnd, end: start });
      }
      const space = ''.padEnd(start - lastEnd);
      lastEnd = end;
      return space + raw.substring(start, end);
    })
    .join('');

  return { out, holes };
}

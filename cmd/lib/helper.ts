import * as path from 'node:path';
import { relativize } from '../../lib/helper.ts';

export function isUrl(s: string) {
  try {
    new URL(s);
    return true;
  } catch {
    return false;
  }
}

export function buildJoin(s: string) {
  if (isUrl(s)) {
    return (other: string) => {
      const u = new URL(other, s);
      return u.toString();
    };
  }
  return (other: string) => path.join(s, other);
}

export function urlAgnosticRelativeBasename(s: string) {
  if (isUrl(s)) {
    // e.g. "https://example.com/src/x.js" => "x.js"
    const u = new URL(s);
    return relativize(path.basename(u.pathname));
  }
  return relativize(path.basename(s));
}

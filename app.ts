#!/usr/bin/env node

import * as cmd from './cmd/lib/cmd.ts';
import cmdSplit from './cmd/split.ts';
import cmdInfo from './cmd/info.ts';

cmd.register('info', {
  description: 'Show information about a JS module file',
  positional: true,
  usageSuffix: '<path>',
  handler(res) {
    if (res.positionals.length !== 1) {
      throw new cmd.CommandError();
    }

    return cmdInfo({ path: res.positionals[0] });
  },
});

cmd.register('split', {
  description: 'Split a JS module into runtime and static code',
  flags: {
    min: {
      type: 'string',
      default: '32',
      short: 'm',
      help: 'only staticify nodes larger than this',
    },
    keep: {
      type: 'string',
      default: '4',
      short: 'k',
      help: 'always keep this many top-sized static bundle(s)',
    },
    'dedup-callables': {
      type: 'boolean',
      default: false,
      short: 'd',
      help: 'dedup callables (may cause inheritance issues)',
    },
    corpus: {
      type: 'string',
      default: '',
      short: 'c',
      help: 'alternative path to historic corpus',
    },
  },
  positional: true,
  usageSuffix: '<source> <outdir/>',
  handler(res) {
    if (res.positionals.length !== 2) {
      throw new cmd.CommandError();
    }

    return cmdSplit({
      min: +(res.values['min'] ?? 0),
      keep: +(res.values['keep'] ?? 0),
      sourcePath: res.positionals[0],
      dist: res.positionals[1],
      oldPath: (res.values['corpus'] as string) || '',
      dedupCallables: Boolean(res.values['dedup-callables']),
    });
  },
});

// TODO: until we rev from node14
const p = Promise.resolve(cmd.run());
p.catch((e) => {
  throw e;
});

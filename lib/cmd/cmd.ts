import { ParseArgsConfig, parseArgs } from 'node:util';

type ParseOptions = NonNullable<ParseArgsConfig['options']>;
type ParsedResults<T> = ReturnType<typeof parseArgs>;

const cmds = new Map<string, CommandConfig<any>>();

const helpOptions: ParseOptions = {
  help: {
    type: 'boolean',
    default: false,
    short: 'h',
  },
};

type CommandConfig<T extends ParseOptions> = {
  description: string;
  flags?: T extends ParseOptions ? T : never;
  positional?: boolean;
  usageSuffix?: string;
  handler: (res: ParsedResults<T>) => any;
};

export const register = <T extends ParseOptions>(cmd: string, config: CommandConfig<T>) => {
  cmds.set(cmd, config);
};

export const run = (argv = process.argv.slice(2)): any => {
  const cmd = argv[0];
  const matched = cmds.get(cmd);
  argv = argv.slice(1);

  if (!matched) {
    const args = parseArgs({ options: helpOptions, args: argv });

    console.warn(`Usage: kuto [command]\n\nCommands:`);

    const minWidth = [...cmds.keys()].reduce((prev, c) => Math.max(c.length, prev), 0);
    for (const [key, c] of cmds) {
      console.warn(' ', key.padEnd(minWidth), c.description);
    }

    console.warn('\nmore info: https://kuto.dev');
    process.exit(args.values['help'] ? 0 : 1);
    throw 'should not get here';
  }

  const args = parseArgs({
    allowPositionals: matched.positional ?? false,
    options: { ...helpOptions, ...matched.flags },
    args: argv,
  });
  const v = args.values as any;

  if (!v['help']) {
    try {
      return matched.handler(args);
    } catch (e) {
      if (!(e instanceof CommandError)) {
        throw e;
      }
    }
  }

  console.warn(
    `Usage: kuto ${cmd} ${matched.usageSuffix ?? ''}\nDescription: ${matched.description}`,
  );
  if (matched.flags) {
    console.warn();
    const flags: ParseOptions = matched.flags;
    for (const [f, config] of Object.entries(flags)) {
      const help = (config as any)['help'] ?? '?';
      const defaultPart = 'default' in config ? ` (default ${config.default})` : '';
      console.warn(`  --${f}${defaultPart}: ${help}`);
    }
  }
  console.warn('\nmore info: https://kuto.dev');
  process.exit(v['help'] ? 0 : 1);
};

export class CommandError extends Error {}

🌈 Kuto makes updating your site's JS better, faster, harder, stronger.
It reduces your download size by re-using code you've already shipped.
Read more [on the blog](https://samthor.au/2024/kuto/), or watch [Theo.gg's video](https://www.youtube.com/watch?v=_sxwQBWJQHA)! 🌈

<img src="https://storage.googleapis.com/hwhistlr.appspot.com/og/kuto.jpeg" width="200" height="105" alt="Kuto tool logo" />

[![Tests](https://github.com/samthor/kuto/actions/workflows/tests.yml/badge.svg)](https://github.com/samthor/kuto/actions/workflows/tests.yml)

It does this by splitting JS files (in ESM) into 'main' and static parts.
The static parts can be cached by clients forever, as they have no side-effects, and can be used as a 'corpus' or dictionary of code that can be called later.
Chromium even caches [the bytecode](https://v8.dev/blog/code-caching-for-devs) of previously shipped files.

Ideally, Kuto operates on a large output bundle from another tool.
Think of it as doing code-splitting 'last', rather than first.

## Requirements

Node 16+.

Kuto works best on large (>1mb) singular JS bundles 'bundled' to ESM — the tool works on a statement level, and an IIFE/webpack output is one giant statement.

## Usage

You can install via "kuto" and then run `npx kuto` to learn more.

To split a JS file, you can then run:

```bash
$ kuto split yourbundle.js out/
```

This will generate a 'main' part and a corpus of code.
If you build or change "yourbundle.js" and run Kuto _again_, this will re-use the existing corpus where possible, and remove completely disused corpus files.

Note that you'll **need to keep the old generated code around** for Kuto to work.
By default, this looks in the output dir, but you can change it with a flag.

### Flags

- `-c <old>` where to find old corpus data (default: use output dir)

  Normally, Kuto reads old corpus data from the output path, but this flag can be used to point to a different location.
  It can also point directly to a Kuto-generated 'main' file.
  This could be useful to point to the currently published version of your code.

  For example:

  - `-c https://example.com/source.js` to load a Kuto-generated 'main' from a real website (uses `fetch()`)
  - `-c path/to/old/source/dir` to use any corpus in this dir

- `-d` dedups callables (default: `false`)

  With this flag enabled, if two classes or callables are exactly the same, they'll be merged into one.
  For example:

  ```ts
  var A = class {};
  var B = class {};

  // will be 'true' in `-d` mode
  new A() instanceof B;
  ```

  This is turned off by default, as it can be dangerous.
  Kuto will still dedup other code where it is safe to do so!

- `-m <bytes>` only yeet code which is larger than this (default: `32`)

  There's overhead to splitting the static parts of your code out, so this limits the process to larger statements.

- `-k <files>` keep this number of static bundles around (default: `4`)

  Kuto can create high levels of fragmentation over time.
  For most sites, you'll end up with one HUGE bundle that contains the bulk of your code, dependencies, etc.
  This flag sets the number of 'corpus' files to keep around, ordered by size.

  (This may not actually be the best way to keep chunks around.
  This flag will probably evolve over time.)

- `-n <name>` use this basename for the output (default: basename of input)

  Normally, Kuto creates output files with the same name as the input files.
  Instead, use this to output e.g., "index.js" regardless of source name.

## Best Practice

One good way to understand what Kuto does is to run `./release.sh`, which builds Kuto itself.
Try running a release, changing something in the source, and releasing again&mdash;you'll see extra static files appear.

This release process runs in three steps:

1. use esbuild to create one bundle (without minification)
2. use kuto to split the bundle
3. use esbuild on all resulting files, _purely_ to minify

## Notes

Kuto bundles [acorn](https://www.npmjs.com/package/acorn) to do its parsing.

There is also has a `kuto info` command to give basic information about an ES Module.
This is the origin of the tool; I wanted something that could inform me about side-effects.

Both `info` and `split` will transparently compile TS/etc via "esbuild" if installed, but it's not a `peerDependency`.

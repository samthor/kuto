Kuto makes updating your site's JS better, faster, harder, stronger.

It does this by splitting JS files (in ESM) into their functional and static parts.
The static parts can be cached by clients forever, as they have no side-effects, and can be used as a 'corpus' or dictionary of code that can be called later.
Chromium even caches [the bytecode](https://v8.dev/blog/code-caching-for-devs) of previously shipped files.

## Usage

You can install via "kuto" and then run `npx kuto` to learn more.
This has commands `split` (as above) and `info` (to find out more about an ES Module).

Kuto is best used on a single large bundle, rather than on lots of smaller ones.
Think of it as doing code-splitting 'last', rather than first.

One good way to understand what Kuto does is to run `./release.sh`, which builds Kuto itself.
Try running a release, changing something in the source, and releasing again&mdash;you'll see extra static files appear.

### Split Flags

- `-d` dedups callable code (default: `false`)

  With this flag enabled, if two classes or callables are exactly the same, they'll be merged into one.
  For example:

  ```ts
  class A {}
  class B {}

  new A() instanceof B; // will be 'true' in `-d` mode
  ```

  This is turned off by default, as it can be dangerous.

## Notes

(This README is a stub.
More will come later after Sam's SydJS talk.)

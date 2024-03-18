Kuto makes updating your site's JS better, faster, harder, stronger.

It does this by splitting JS files (in ESM) into their functional and static parts.
The static parts can be cached by clients forever, as they have no side-effects, and can be used as a 'corpus' or dictionary of code that can be called later.
Chromium even caches [the bytecode](https://v8.dev/blog/code-caching-for-devs) of previously shipped files.

## Usage

You can install via "kuto" and then run `npx kuto` to learn more.

Kuto is best used on a single large bundle, rather than on lots of smaller ones.
Think of it as doing code-splitting 'last', rather than first.

## Notes

(This README is a stub.
More will come later after Sam's SydJS talk.)

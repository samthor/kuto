#!/bin/bash

set -eu

esbuild --bundle --format=esm --outfile=dist/raw/app.js --platform=node --external:esbuild \
    app.ts
node dist/raw/app.js split dist/raw/app.js dist/split/

rm dist/*.js &2>/dev/null || true
for X in dist/split/*; do
  BASE=$(basename $X)
  esbuild --format=esm --outfile=dist/$BASE --minify $X
done

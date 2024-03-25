#!/bin/bash

set -eu

TARGET=node12 # old codebases require old builds

esbuild \
    --bundle \
    --format=esm \
    --outfile=dist/raw/app.js \
    --platform=node \
    --external:esbuild \
    --target=${TARGET} \
    app.ts
node dist/raw/app.js split dist/raw/app.js dist/split/

rm dist/*.js &2>/dev/null || true
for X in dist/split/*; do
  BASE=$(basename $X)
  esbuild --format=esm --outfile=dist/$BASE --minify $X
done

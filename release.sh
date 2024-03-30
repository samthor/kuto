#!/bin/bash

set -eu

TARGET=node14
OUTFILE=dist/raw/app.js

esbuild \
    --bundle \
    --format=esm \
    --outfile=${OUTFILE} \
    --platform=node \
    --external:esbuild \
    --target=${TARGET} \
    app/index.ts

node ${OUTFILE} split ${OUTFILE} dist/split/

rm dist/*.js &2>/dev/null || true
for X in dist/split/*; do
  BASE=$(basename $X)
  esbuild --format=esm --outfile=dist/$BASE --minify $X
done

# confirms the binary runs at all
node dist/app.js info dist/app.js >/dev/null

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
    app.ts

node ${OUTFILE} split ${OUTFILE} dist/split/

rm dist/*.js &2>/dev/null || true
for X in dist/split/*; do
  BASE=$(basename $X)
  esbuild --format=esm --outfile=dist/$BASE --minify $X
done

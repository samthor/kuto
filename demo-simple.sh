#!/bin/bash

set -eu

mkdir -p demo/simple
cd demo/simple

# run twice to prove re-use
npx tsx ../../app.ts split ../../test/data/simple.js dist/ $@
npx tsx ../../app.ts split ../../test/data/simple.js dist/ $@

# TODO: check not same bytes

node dist/simple.js

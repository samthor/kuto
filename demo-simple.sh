#!/bin/bash

set -eu

mkdir -p demo/simple
cd demo/simple

# run twice to prove re-use
npx tsx ../../demo.ts ../../test.js
npx tsx ../../demo.ts ../../test.js

# TODO: check not same bytes

node dist/test.js

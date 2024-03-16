#!/bin/bash

set -eu

rm -rf dist

# run twice to prove re-use
npx tsx demo.ts test.js
npx tsx demo.ts test.js

# TODO: check not same bytes

node dist/test.js

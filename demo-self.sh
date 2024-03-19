#!/bin/bash

set -eu

mkdir -p demo/self
cd demo/self

npx esbuild --bundle --format=esm --outfile=self.js ../../app.ts --platform=node --external:esbuild
node self.js split self.js dist/
# node dist/demo.js ../test.js

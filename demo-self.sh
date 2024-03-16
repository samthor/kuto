#!/bin/bash

set -eu

mkdir -p demo/self
cd demo/self

npx esbuild --bundle --format=esm --outfile=self.js ../../demo.ts --platform=node
node self.js self.js
# node dist/demo.js ../test.js

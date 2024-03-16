#!/bin/bash

set -eu

npx esbuild --bundle --format=esm --outfile=demo-self/demo.js demo.ts --platform=node
cd self
node demo.js demo.js
node dist/demo.js ../test.js

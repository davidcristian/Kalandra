#!/bin/bash
set -e

# Remove ./renderer/dist if it exists
rm -rf ./renderer/dist

# Remove ./main/dist if it exists
rm -rf ./main/dist

cd ./renderer

npm ci
npm run make-index-files
npm run build
cd ..

cd ./main

npm ci
npm run build
npm run package

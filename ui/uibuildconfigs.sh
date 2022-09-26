#!/bin/bash

#fail all if one fails
set -e

echo "Building UI configs..."

rm -f config-service-base-auto-generated.json

python3 build-base-configs.py ui #> /dev/null

mv -f ./config-service-base-auto-generated.json ./src/assets/data

echo "Done building UI configs."
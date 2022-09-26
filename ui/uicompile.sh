#!/bin/bash

#fail all if one fails
set -e

echo "Running UI build..."

echo "Changing directory to '`dirname "$0"`' to run script..."
cd `dirname "$0"`

./uibuildconfigs.sh

npm install
npm run build:prod

echo "UI build complete."
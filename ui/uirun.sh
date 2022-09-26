#!/bin/bash

#fail all if one fails
set -e

echo "Running UI..."

echo "Changing directory to '`dirname "$0"`' to run script..."
cd `dirname "$0"`

./uibuildconfigs.sh

npm start

echo "Done running UI."
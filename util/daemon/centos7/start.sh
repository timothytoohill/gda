#!/bin/bash
set -e

echo "Starting GDA via docker compose..."
scriptPath=$(realpath "$0")
scriptDirRelative=$(dirname "$scriptPath")
pushd "$scriptDirRelative"
scriptDir=$(pwd)
popd
cd $scriptDir/../../../
docker compose -f docker-compose.yml create --no-recreate
docker compose -f docker-compose.yml start
echo "Done starting GDA via docker compose."

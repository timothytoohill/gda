#!/bin/bash
set -e

echo "Stopping GDA via docker compose..."
scriptPath=$(realpath "$0")
scriptDirRelative=$(dirname "$scriptPath")
pushd "$scriptDirRelative"
scriptDir=$(pwd) #need absolute path for service file
popd
cd $scriptDir/../../../
docker compose -f docker-compose.yml stop
echo "Done stopping GDA via docker compose."
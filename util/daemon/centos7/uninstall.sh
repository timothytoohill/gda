#!/bin/bash

echo "Stopping GDA and removing service file..."
systemctl stop gda
systemctl disable gda
rm -f /etc/systemd/system/gda.service
echo "Done stopping GDA and removing service file."

echo "Stopping and removing containers..."
scriptPath=$(realpath "$0")
scriptDirRelative=$(dirname "$scriptPath")
pushd "$scriptDirRelative"
scriptDir=$(pwd) #need absolute path for service file
popd
cd $scriptDir/../../../
docker compose -f docker-compose.yml down
echo "Done stopping and removing containers."

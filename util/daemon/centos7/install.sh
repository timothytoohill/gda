#!/bin/bash
set -e

echo "Installing GDA service file and enabling..."
scriptPath=$(realpath "$0")
scriptDirRelative=$(dirname "$scriptPath")
pushd "$scriptDirRelative"
scriptDir=$(pwd) #need absolute path for service file
popd
startScriptPath="$scriptDir/start.sh"
stopScriptPath="$scriptDir/stop.sh"
sed -e "s|\[START_SCRIPT\]|$startScriptPath|g" -e "s|\[STOP_SCRIPT\]|$stopScriptPath|g" gda.service.template > $scriptDir/gda.service
cp -f $scriptDir/gda.service /etc/systemd/system/gda.service
systemctl daemon-reload
systemctl enable gda
echo "GDA is installed as a daemon that will start upon reboot. Run 'systemctl start gda' to start the daemon."

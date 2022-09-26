#!/bin/bash

#fail all if one fails
set -e

#echo "Change to parent directory..."
#cd ..
#echo "Unaliase cp command so overwrite can be done..."
#unalias cp

#echo "Go ahead and prune images..."
#docker image prune -f

echo "Build the base image..."
#docker build --rm -t gda:BaseImage -f ./containers/DockerFileBase .
docker build -t gda:BaseImage -f ./containers/DockerFileBase .

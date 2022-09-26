#!/bin/bash

#fail all if one fails
set -e

if [ -z "$1" ]
  then
    echo "Must supply source repo and image name."
    exit 1
fi

if [ -z "$2" ]
  then
    echo "Must supply dest repo and image name."
    exit 1
fi

#echo "Change to parent directory..."
#cd ..
#echo "Unaliase cp command so overwrite can be done..."
#unalias cp

echo "Tagging $1 as $2..."
docker tag $1 $2
echo "Done tagging $1 as $2."

echo "Pushing image $2..."
docker push $2
echo "Done pushing image $2."

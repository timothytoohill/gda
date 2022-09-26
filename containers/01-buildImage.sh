#!/bin/bash

#fail all if one fails
set -e

if [ -z "$1" ]
  then
    echo "Must supply repo and image name."
    exit 1
fi

if [ -z "$2" ]
  then
    echo "Must supply docker file location."
    exit 1
fi

#echo "Change to parent directory..."
#cd ..
#echo "Unaliase cp command so overwrite can be done..."
#unalias cp

echo "Build image $1 from $2..."
#docker build --rm -t $1 -f $2 .
docker build -t $1 -f $2 .

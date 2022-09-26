#!/bin/bash

#fail all if one fails
#set -e

if [ -z "$1" ]
  then
    echo "Must supply repo and image name."
    exit 1
fi


if [ -z "$2" ]
  then
    echo "Must supply container name."
    exit 1
fi

params=""
if [ -z "$3" ]
  then
    echo "No params specified."
  else
    params="$3"
fi

echo "Starting docker container from $1, using name $2, and params $3..."

docker stop $2 &> /dev/null
docker rm $2 &> /dev/null

if [ "$2" == "gremlinserver" ]
  then
    echo "docker run -t $params --name $2 $1 -g -s"
    docker run -t $params --name $2 $1 -g -s
  else
    echo "docker run -t $params --name $2 $1"
    docker run -t $params --name $2 $1
fi

docker stop $2 &> /dev/null
docker rm $2 &> /dev/null

echo "Container run done."
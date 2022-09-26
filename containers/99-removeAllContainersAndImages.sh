#!/bin/bash

#fail all if one fails
#set -e

echo "Remove all containers and images..."

if [[ $(docker ps -a -q) ]]; then
	docker stop $(docker ps -a -q)
fi

if [[ $(docker ps -a -q) ]]; then
	docker rm $(docker ps -a -q)
fi

if [[ $(docker images -a -q) ]]; then
	docker rmi $(docker images -a -q) --force
fi

echo "Done removing containers and images."

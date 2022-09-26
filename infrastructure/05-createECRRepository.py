import sys

sys.dont_write_bytecode = True
sys.path.append("../libraries")

import boto3

import liballinit
import libconf
import liblogging

log = liblogging.Logger('create-ecr-repo').log

def createECRRepository(configs):
    repositoryName = libconf.getECRRepositoryName()
    log("Creating '" + repositoryName + "' repository...")
    ecrClient = boto3.client("ecr")
    response = ecrClient.describe_repositories()
    for repo in response["repositories"]:
        if repo["repositoryName"] == repositoryName:
            log("Repository '" + repositoryName + "' exists.")
            return
    ecrClient.create_repository(repositoryName = repositoryName, tags = configs["aws"]["tags"])
    log("ECR repository '" + repositoryName + "' has been created.")

def run():
    configs = libconf.getLoadedConfigs()
    if configs["aws"]["usingAWS"]:
        createECRRepository(configs)

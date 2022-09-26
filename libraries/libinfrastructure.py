import sys

sys.dont_write_bytecode = True

import json
import datetime
import threading
import boto3

import libconf
import liblogging

log = liblogging.Logger('infrastructure').log
awsPolicyName = libconf.getAppName()
awsPolicyPathPrefix = "/" + awsPolicyName + "/"
awsRoleName = libconf.getAppName()

iam = None
neptuneClient = None

def initIAM():
    global iam
    if iam:
        return None
    iam = boto3.client("iam")
    return None

def initNeptune():
    global neptuneClient
    if neptuneClient:
        return None
    neptuneClient = boto3.client("neptune")
    return None

def createAppPolicy(policy, update=True):
    initIAM()
    log("Creating app policy...")
    existingARN = ""
    try:
        existingARN = getAppPolicyARN()
        if len(existingARN) > 0:
            if update:
                log("App policy already exists. Updating...")
                try:
                    detachAppPolicyFromAppRole()
                except Exception as e:
                    pass
                deleteAppPolicy()
            else:
                log("App policy already exists.")
                return
    except Exception as e:
        pass
    try:
        response = iam.create_policy(PolicyDocument=policy, PolicyName=awsPolicyName, Path=awsPolicyPathPrefix, Description="Role used by " + libconf.getAppName() + ".")
        log("Done creating app policy.")
    except Exception as e:
        log("Could not create app policy: " + str(e))
        raise e

def deleteAppPolicy():
    initIAM()
    log("Deleting app policy...")
    try:
        arn = getAppPolicyARN()
        response = iam.delete_policy(PolicyArn=arn)
        log("Done deleting app policy.")
    except Exception as e:
        log("Could not delete app policy: " + str(e))
        raise e

def createAppRole(assumeRolePolicy):
    initIAM()
    log("Creating app role...")
    existingARN = ""
    try:
        existingARN = getAppRoleARN()
        if len(existingARN) > 0:
            log("App role already exists.")
            return
    except Exception as e:
        pass
    try:
        response = iam.create_role(AssumeRolePolicyDocument=assumeRolePolicy, RoleName=awsRoleName, Description="Role used by " + libconf.getAppName() + ".")
        log("Done creating app role.")
    except Exception as e:
        log("Could not create app role. Probably already exists: " + str(e))
        raise e
    return

def attachAppPolicyToAppRole():
    initIAM()
    log("Attaching app policy to app role...")
    try:
        appPolicyARN = getAppPolicyARN()
        iam.attach_role_policy(RoleName=awsRoleName, PolicyArn=appPolicyARN)
        log("Done attaching app policy to app role.")
    except Exception as e:
        log("Could not attach app policy to app role: " + str(e))
        raise e

def detachAppPolicyFromAppRole():
    initIAM()
    log("Detaching app policy from app role...")
    try:
        appPolicyARN = getAppPolicyARN()
        iam.detach_role_policy(RoleName=awsRoleName, PolicyArn=appPolicyARN)
        log("Done detaching app policy from app role.")
    except Exception as e:
        log("Could not detach app policy from app role: " + str(e))
        raise e

def getAppPolicyARN():
    initIAM()
    log("Getting app policy ARN...")
    arn = ""
    try:
        response = iam.list_policies(Scope="All", OnlyAttached=False, PathPrefix=awsPolicyPathPrefix)
        arn = response["Policies"][0]["Arn"]
        log("Done getting app policy ARN.")
    except Exception as e:
        log("Could not get app policy ARN: " + str(e))
        raise e
    return arn

def getAppRoleARN():
    initIAM()
    log("Getting app role ARN...")
    arn = ""
    try:
        response = iam.get_role(RoleName = awsRoleName)
        arn = response["Role"]["Arn"]
        log("Done getting app role ARN.")
    except Exception as e:
        log("Could not get app role ARN: " + str(e))
        raise e
    return arn

def getECRRepoURI():
    ecr = boto3.client("ecr")
    ecrRepoName = libconf.getDockerRepositoryName()
    response = ecr.describe_repositories(repositoryNames = [ecrRepoName])
    repoURI = response["repositories"][0]["repositoryUri"]
    return repoURI

def getDockerServiceRepoURI(serviceName):
    if libconf.getIsUsingAWS():
        return getECRRepoURI() + ":" + serviceName
    else:
        return libconf.getAppName().replace("-", "/") + ":" + serviceName

def getTargetGroupARN(name):
    elbClient = boto3.client("elbv2")
    response = elbClient.describe_target_groups(Names = [name])
    return response["TargetGroups"][0]["TargetGroupArn"]

def getAppConfigs():
    configs = libconf.loadAndMergeAllConfigs()
    elbClient = None
    for serviceName in configs["appServices"]:
        fullname = libconf.generateCompleteAppServiceName(serviceName, configs)
        configs["appServices"][serviceName]["fullName"] = fullname
        if configs["aws"]["usingAWS"]:
            if not elbClient:
                elbClient = boto3.client("elbv2")
            try:
                lbresponse = elbClient.describe_load_balancers(Names = [fullname])
                configs["appServices"][serviceName]["address"] = lbresponse["LoadBalancers"][0]["DNSName"]
            except Exception as e:
                pass
    return configs


import sys

sys.dont_write_bytecode = True
sys.path.append("../libraries")

import os

import liballinit
import libconf
import liblogging
import libinfrastructure

log = liblogging.Logger('create-policy-and-role').log
currentDir = os.path.dirname(__file__)
if len(currentDir) == 0:
    currentDir = "."
awsAssumeRolePolicyFile = currentDir + "/98-awsAssumeRolePolicy.json"
awsPolicyFile = currentDir + "/99-awsAppPolicy.json"

def createPolicyAndRole():
    log("Creating AWS policy and role...")
    policy = loadAWSPolicy()
    assumeRolePolicy = loadAWSAssumeRolePolicy()
    libinfrastructure.createAppPolicy(policy)
    libinfrastructure.createAppRole(assumeRolePolicy)
    libinfrastructure.attachAppPolicyToAppRole()
    log("Done creating AWS policy and role.", waitForSend = True)
    return

def loadAWSPolicy():
    with open(awsPolicyFile, 'r') as f:
        return f.read()

def loadAWSAssumeRolePolicy():
    with open(awsAssumeRolePolicyFile, 'r') as f:
        return f.read()

def run():
    createPolicyAndRole()

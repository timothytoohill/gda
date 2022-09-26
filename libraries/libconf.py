import sys

sys.dont_write_bytecode = True

import json
import os
import socket
import boto3
from pygit2 import Repository
from collections import OrderedDict

import libutil
import liblogging
from libutil import toJSON
from libutil import getUUID

boto3.compat.filter_python_deprecation_warnings()

log = liblogging.Logger('conf').log

currentDir = os.path.dirname(__file__)
if len(currentDir) == 0:
    currentDir = "."

allConfigs = OrderedDict()
baseConfigs = OrderedDict()
branchConfigs = OrderedDict()
serviceConfigs = OrderedDict()
serviceBaseConfigs = OrderedDict()
s3Configs = OrderedDict()
loadedConfigs = OrderedDict()

configDir = currentDir + "/configs"
baseConfigFile = configDir + "/base.json"
branchConfigFile = ""
serviceConfigFile = "config-service.json"
serviceBaseConfigFile = "config-service-base-auto-generated.json"

isInitialized = False

def init():
    global isInitialized
    if isInitialized:
        return
    loadConfigs()
    isInitialized = True
    return

def loadConfigs():
    global loadedConfigs
    loadedConfigs = loadAndMergeAllConfigs()

def loadConfigsFromStream(stream):
    return json.load(stream, object_pairs_hook = OrderedDict)

def loadConfigFile(filePath):
    data = OrderedDict()
    log("Loading local config file (" + filePath + ")...")
    try:
        with open(filePath, "r") as f:
            fileData = loadConfigsFromStream(f)
        libutil.mergeDictionaries(fileData, data)
    except Exception as e:
        log("Failed to load local config file (" + filePath + ").")
        return data
    log("Local config file loaded (" + filePath + ").")
    return data

def getMergedConfigs():
    global allConfigs
    global baseConfigs
    global serviceBaseConfigs
    global branchConfigs
    global s3Configs
    global serviceConfigs
    mergedConfigs = OrderedDict()
    libutil.mergeDictionaries(allConfigs, mergedConfigs)
    libutil.mergeDictionaries(baseConfigs, mergedConfigs)
    libutil.mergeDictionaries(serviceBaseConfigs, mergedConfigs)
    libutil.mergeDictionaries(s3Configs, mergedConfigs)
    libutil.mergeDictionaries(branchConfigs, mergedConfigs)
    libutil.mergeDictionaries(serviceConfigs, mergedConfigs)
    return mergedConfigs

def loadAndMergeAllConfigs():
    global allConfigs
    global baseConfigs
    global serviceBaseConfigs
    global branchConfigs
    global s3Configs
    global serviceConfigs
    log("Loading all configs...")
    allConfigs = loadAllConfigFiles()
    log("Loading base config file...")
    baseConfigs = loadConfigFile(baseConfigFile)
    log("Done loading base config file.")
    log("Loading service base configs...")
    serviceBaseConfigs = loadConfigFile(serviceBaseConfigFile)
    log("Done loading service base configs.")
    if baseConfigs["deriveBranchFromGit"]:
        setBranchFromLocalGitRepo(allConfigs)
        branchConfigFile = getBranchConfigFileName(allConfigs)
        log("Loading branch configs...")
        branchConfigs = loadConfigFile(branchConfigFile)
        log("Done loading branch configs.")
    log("Loading service configs...")
    serviceConfigs = loadConfigFile(serviceConfigFile)
    log("Done loading service configs.")
    mergedConfigs = getMergedConfigs()
    if mergedConfigs["aws"]["loadConfigsFromS3"]:
        log("Loading configs from S3...")
        s3Configs = loadS3Configs(mergedConfigs)
        log("Done loading configs from S3.")
        mergedConfigs = getMergedConfigs()
    log("Merged configs: Service -> Branch -> S3 -> Service Base -> Base -> All")
    log("Done loading all configs.")
    return mergedConfigs

def loadAllConfigFiles():
    data = OrderedDict()
    for dirName, subdirList, fileList in os.walk(configDir):
        for fileName in fileList:
            if ".json" in fileName:
                configData = loadConfigFile(dirName + "/" + fileName)
                libutil.mergeDictionaries(configData, data)
    return data

def loadS3Configs(configs = None):
    if configs == None:
        configs = getLoadedConfigs()
    data = OrderedDict()
    bucketName = getAppBucketName(configs)
    bucketKey = getAppBucketConfigKey(configs)
    s3 = boto3.resource('s3')
    log("Loading S3 config file from 's3://" + bucketName + "/" + bucketKey + "'...")
    body = None
    try:
        obj = s3.Object(bucketName, bucketKey)
        body = obj.get()['Body']
    except Exception as e:
        pass
    if body:
        data = loadConfigsFromStream(body)
        log("S3 config file 's3://" + bucketName + "/" + bucketKey + "' loaded.")
    else:
        log("S3 config file 's3://" + bucketName + "/" + bucketKey + "' not found or empty.")
    return data

def saveConfigsToS3(configs = None):
    if configs == None:
        configs = getLoadedConfigs()
    bucketName = getAppBucketName(configs)
    bucketKey = getAppBucketConfigKey(configs)
    log("Uploading configs to S3 '" + bucketName + "/" + bucketKey + "'...")
    s3 = boto3.client("s3")
    s3.put_object(Body=toJSON(configs), Bucket=bucketName, Key=bucketKey)
    log("Done uploading configs to S3 '" + bucketName + "/" + bucketKey + "'.")
    return

def saveLocalConfigs(configFile, configs = None):
    if configs == None:
        configs = getLoadedConfigs()
    log("Saving local configs (" + configFile + ")...")
    with open(configFile, "w") as f:
        f.write(toJSON(configs))
    log("Done saving local config (" + configFile + ").")
    return

def saveServiceBaseConfigFile(dir, configs = None):
    if configs == None:
        configs = getLoadedConfigs()
    saveLocalConfigs(dir + "/" + serviceBaseConfigFile, configs)

def saveServiceBaseConfigFileToLib(configs = None):
    if configs == None:
        configs = getLoadedConfigs()
    saveLocalConfigs(configDir + "/" + serviceBaseConfigFile, configs)

def getLoadedConfigs():
    global loadedConfigs
    return loadedConfigs

def getLoadedConfigsCopy():
    global loadedConfigs
    configs = OrderedDict()
    libutil.mergeDictionaries(loadedConfigs, configs)
    return configs

def getBranch(configs = None):
    if configs == None:
        configs = getLoadedConfigs()
    return configs["branch"]

def getAppName(configs = None):
    if configs == None:
        configs = getLoadedConfigs()
    appOrg = configs["appOrganization"]
    appName = configs["appName"]
    return generateName([appOrg, appName])

def getCompleteAppName(configs = None):
    if configs == None:
        configs = getLoadedConfigs()
    branch = getBranch(configs)
    return generateName([getAppName(configs), branch])

def getCompleteAppServiceName(configs = None):
    if configs == None:
        configs = getLoadedConfigs()
    return generateCompleteAppServiceName(configs["thisService"], configs)

def getAppServiceNamePostfix(configs = None):
    if configs == None:
        configs = getLoadedConfigs()
    return generateAppServiceNamePostfix(configs["thisService"], configs)

def generateCompleteAppServiceName(serviceName, configs = None):
    if configs == None:
        configs = getLoadedConfigs()
    appOrg = configs["appOrganization"]
    appName = configs["appName"]
    return generateName([appOrg, appName, generateAppServiceNamePostfix(serviceName)])

def generateAppServiceNamePostfix(serviceName, configs = None):
    if configs == None:
        configs = getLoadedConfigs()
    branch = getBranch(configs)
    return generateName([branch, serviceName])

def generateName(names, sep = '-'):
    index = 0
    completeName = ""
    while index < len(names):
        name = names[index]
        if len(name) > 0:
            if len(completeName) > 0:
                completeName = completeName + sep + name
            else:
                completeName = name
        index = index + 1
    return completeName

def generateCompleteAppServiceID(configs = None):
    if configs == None:
        configs = getLoadedConfigs()
    return getCompleteAppServiceName(configs) + "-" + libutil.getThisInstanceID()

def generateCompleteAppServiceTopic(topic, configs = None):
    if configs == None:
        configs = getLoadedConfigs()
    t = generateCompleteAppServiceID(configs)
    t = t.replace("-", "/")
    t = t + "/" + topic
    return t

def getBranchConfigFileName(configs = None):
    if configs == None:
        configs = getLoadedConfigs()
    completeAppName = getCompleteAppName(configs)
    return configDir + "/" + completeAppName.replace("-", "/") + ".json"

def getThisService(configs = None):
    if configs == None:
        configs = getLoadedConfigs()
    return configs["thisService"]

def getAppBucketName(configs = None):
    if configs == None:
        configs = getLoadedConfigs()
    bucketName = getAppName(configs)
    if len(configs["aws"]["s3BucketName"]) > 0:
        bucketName = configs["aws"]["s3BucketName"]
    return bucketName

def getAppBucketDirectory(configs = None):
    if configs == None:
        configs = getLoadedConfigs()
    return getBranch(configs)

def getAppBucketConfigKey(configs = None):
    if configs == None:
        configs = getLoadedConfigs()
    bucketKey = "configs.json"
    directory = getAppBucketDirectory(configs)
    if len(configs["aws"]["s3ConfigFileName"]) > 0:
        bucketKey = configs["aws"]["s3ConfigFileName"]
    return directory + "/" + bucketKey

def getDockerRepositoryName(configs = None):
    if configs == None:
        configs = getLoadedConfigs()
    return getCompleteAppName(configs)

def setBranchFromLocalGitRepo(configs = None):
    if configs == None:
        configs = getLoadedConfigs()
    log("Attempting to set branch from git repo...")
    gitDirs = [ os.getcwd() + "/.git", os.getcwd() + "/../.git" ]
    found = False
    for gitDir in gitDirs:
        if os.path.isdir(gitDir):
            repo = Repository(gitDir)
            branch = repo.head.name.replace("refs/heads/", "")
            log("Setting branch to '" + branch + "'...")
            configs["branch"] = branch
            found = True
            break
    if not found:
        log("No git repo found to set branch.")                
    return configs

def getIsUsingAWS(configs = None):
    if configs == None:
        configs = getLoadedConfigs()
    return configs["aws"]["usingAWS"]

def getAddressForService(serviceName, configs = None):
    if configs == None:
        configs = getLoadedConfigs()
    if serviceName in configs["appServices"]:
        if "address" in configs["appServices"][serviceName]:
            if len(configs["appServices"][serviceName]["address"]) > 0:
                return configs["appServices"][serviceName]["address"]
    if "defaultAddress" in configs:
        if len(configs["defaultAddress"]) > 0:
            return configs["defaultAddress"]
    try:
        hostip = socket.gethostbyname(serviceName)
        return serviceName
    except Exception as e:
        pass
    
    return "localhost"
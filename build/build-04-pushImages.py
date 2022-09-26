#!/usr/local/bin/python3

import sys

sys.dont_write_bytecode = True
sys.path.append("../libraries")
sys.path.append("../infrastructure")

import os
import liballinit
import liblogging
import libutil
import libinfrastructure
import libconf
import libdb_relational

log = liblogging.Logger('push-images').log

#perform operations from root of repo dir
os.chdir(os.path.dirname(os.path.realpath(__file__)) + "/../")

configs = libconf.getLoadedConfigs()

def pushImageForService(serviceName):
    service = configs["appServices"][serviceName]
    serviceURI = ""
    if configs["aws"]["usingAWS"]:
        serviceURI = libinfrastructure.getECRServiceRepoURI(serviceName)
    else:
        serviceURI = "timothytoohill/gda:" + serviceName
    currentURI = libinfrastructure.getDockerServiceRepoURI(serviceName)
    params = currentURI + " " + serviceURI
    cmd = "containers/02-pushImage.sh " + params
    try:
        for line in libutil.shellReader(cmd):
            log(line)
    except Exception as e:
        log("Failed: " + str(e))
        sys.exit(e)
    
def run(serviceName = None):
    log("Pushing images...")
    if serviceName == None:
        for serviceName in configs["appServices"]:
            pushImageForService(serviceName)
    else:
        pushImageForService(serviceName)
    log("Done pushing images.", waitForSend = True)
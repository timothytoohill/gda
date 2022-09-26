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

log = liblogging.Logger('images').log

#perform operations from root of repo dir
os.chdir(os.path.dirname(os.path.realpath(__file__)) + "/../")

configs = libconf.getLoadedConfigsCopy()

def buildImage(serviceName, configs):
    service = configs["appServices"][serviceName]
    serviceURI = libinfrastructure.getDockerServiceRepoURI(serviceName)
    dir = service["directory"]
    preBuildScript = service["preBuildScript"]
    if len(preBuildScript) > 0:
        preBuildScript = dir + "/" + preBuildScript
        try:
            log("Running pre-build script '" + preBuildScript + "'...")
            for line in libutil.shellReader(preBuildScript):
                log(line)
            log("Done running pre-build script '" + preBuildScript + "'.")
        except Exception as e:
            log("Failed: " + str(e))
    if configs["appServices"][serviceName]["usesLocalConfigs"]:
        serviceConfigs = libconf.loadConfigFile(dir + "/" + libconf.serviceConfigFile)
        libutil.mergeDictionaries(serviceConfigs, configs)
        libconf.saveServiceBaseConfigFile(dir, configs)
    params = serviceURI + " '" + dir + "/" + service["dockerFileLocation"] + "'"
    cmd = "containers/01-buildImage.sh " + params
    log("Running " + cmd + "...")
    try:
        for line in libutil.shellReader(cmd):
            log(line)
    except Exception as e:
        log("Failed: " + str(e))
        sys.exit(e)

def run(serviceName = None, includeBase = False, onlyBase = False):
    if includeBase:
        log("Building base image...")
        cmd = "containers/00-buildBaseImage.sh"
        log("Running " + cmd + "...")
        try:
            for line in libutil.shellReader(cmd):
                log(line)
        except Exception as e:
            log("Failed: " + str(e))
            sys.exit(e)
        log("Done building base image.")
    if not onlyBase:
        log("Building app service images...")
        if serviceName == None:
            for serviceName in configs["appServices"]:
                buildImage(serviceName, configs)
        else:
            buildImage(serviceName, configs)
        log("Done building app service images.", waitForSend = True)
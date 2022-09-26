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

log = liblogging.Logger('service').log

#perform operations from root of repo dir
os.chdir(os.path.dirname(os.path.realpath(__file__)) + "/../")

configs = libconf.getLoadedConfigsCopy()

log("Starting build processes...")

serviceName = None

includeEnv = "no"

def buildService(serviceName):
    x = __import__("build-02-buildInfrastructure")
    x.run(serviceName)
    x = __import__("build-03-buildImages")
    x.run(serviceName)
    x = __import__("build-04-pushImages")
    x.run(serviceName)
    if configs["aws"]["usingAWS"]:
        x = __import__("build-05-buildServices")
        x.run(serviceName)

if len(sys.argv) > 1:
    serviceName = sys.argv[1]
    log("Only building for service '" + serviceName + "'...")
if len(sys.argv) > 2:
    includeEnv = sys.argv[2]
    if includeEnv == "includeEnv":
        log("Installing environment too.")
    else:
        log("Invalid param '" + includeEnv + "'.")
        quit()

if includeEnv == "includeEnv":
    cmd = "infrastructure/00-installDevEnvironment.sh"
    log("Running " + cmd + "...")
    try:
        for line in libutil.shellReader(cmd):
            log(line)
    except Exception as e:
        log("Failed: " + str(e))
        sys.exit(e)

    cmd = "infrastructure/01-installEnvironment.sh"
    log("Running " + cmd + "...")
    try:
        for line in libutil.shellReader(cmd):
            log(line)
    except Exception as e:
        log("Failed: " + str(e))
        sys.exit(e)

if serviceName == None:
    for serviceName in configs["appServices"]:
        log("Building service '" + serviceName + "'...")
        buildService(serviceName)
        log("Done building service '" + serviceName + "'.")
else:
    buildService(serviceName)

log("Build complete.", waitForSend = True)

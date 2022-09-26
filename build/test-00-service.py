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

log = liblogging.Logger('test-service').log

#perform operations from root of repo dir
os.chdir(os.path.dirname(os.path.realpath(__file__)) + "/../")

log(libconf.generateCompleteAppServiceTopic("test-service"))

def run():
    serviceName = None
    build = False
    configs = libconf.getLoadedConfigs()

    if len(sys.argv) > 1:
        serviceName = sys.argv[1]
    else:
        log("Need to supply service name.")
        quit()

    if len(sys.argv) > 2:
        if sys.argv[2] == "build":
            build = True
        else:
            log("Invalid option '" + sys.argv[2] + "'. 'build' is the only option.")

    serviceURI = libinfrastructure.getDockerServiceRepoURI(serviceName)
    log("Docker service URI: " + serviceURI)

    if build:
        x = __import__("05-createECRRepository")
        x.run()
        x = __import__("build-03-buildImages")
        x.run(serviceName, includeBase)

    log("Testing service '" + serviceName + "'...")
    ports = ""
    if "ports" in configs["appServices"][serviceName]:
        for port in configs["appServices"][serviceName]["ports"]:
            ports = ports + "-p " + str(port) + ":" + str(port) + " "
    else:
        port = str(configs["appServices"][serviceName]["port"])
        ports = "-p " + port + ":" + port
    cmd = "containers/98-runContainer.sh " + serviceURI + " " + serviceName + " \"" + ports + "\""
    log("Running '" + cmd + "'...")
    try:
        for line in libutil.shellReader(cmd):
            log(line)
    except Exception as e:
        log("Failed: " + str(e))
        sys.exit(e)

    log("Done testing '" + serviceName + "'.", waitForSend=True)

run()

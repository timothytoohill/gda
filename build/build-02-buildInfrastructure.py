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

log = liblogging.Logger('infrastructure').log

#perform operations from root of repo dir
os.chdir(os.path.dirname(os.path.realpath(__file__)) + "/../")

configs = libconf.getLoadedConfigsCopy()

def run(serviceName = None):
    log("Building infrastructure...")
    if configs["aws"]["usingAWS"]:
        x = __import__("02-createPolicyAndRole")
        x.run()
        x = __import__("03-createBucket")
        x.run()
        x = __import__("04-uploadConfigsToS3")
        x.run()
        x = __import__("05-createECRRepository")
        x.run()
        x = __import__("06-createLoadBalancers")
        x.run(serviceName)
    log("Done building infrastructure.", waitForSend = True)
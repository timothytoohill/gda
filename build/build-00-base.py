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

log = liblogging.Logger('base').log

#perform operations from root of repo dir
os.chdir(os.path.dirname(os.path.realpath(__file__)) + "/../")

log("Starting build process for base image...")

serviceName = None

x = __import__("build-03-buildImages")
x.run(serviceName = serviceName, includeBase = True, onlyBase = True)

log("Build of base image complete.", waitForSend = True)

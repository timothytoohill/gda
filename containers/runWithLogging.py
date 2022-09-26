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

log = liblogging.Logger('console').log

def run():
    executable = ""
    if len(sys.argv) > 1:
        executable = "\"" + sys.argv[1] + "\""
    else:
        log("Need to suppy executable to run.")
        raise Exception("Need to supply executable to run.")

    args = ""
    argIndex = 2
    while argIndex < len(sys.argv):
        args = args + "\"" + sys.argv[argIndex] + "\""
        argIndex += 1

    fullCmd = executable + " " + args
    log("Starting run of: '" + fullCmd + "'...")
    for line in libutil.shellReader(fullCmd):
        log(line)
    log("Done running '" + fullCmd + "'.")

run()

import sys

sys.dont_write_bytecode = True
sys.path.append("../libraries")

import hashlib
import pathlib
import io
import traceback
import uuid
import json
import csv
import boto3
import threading
import time
import requests

import gremlin_python
from gremlin_python import statics
from gremlin_python.structure.graph import Graph
from gremlin_python.process.graph_traversal import __
from gremlin_python.process.strategies import *
from gremlin_python.driver.driver_remote_connection import DriverRemoteConnection
from gremlin_python.process.traversal import T, P, Operator

import liballinit
import libconf
import liblogging
import libinfrastructure
import libfastapi
import libutil
import libcore_lists

logger = liblogging.Logger('graphdb-connections')
log = logger.log
configs = libconf.getLoadedConfigs()

def connectGraphDB(endpoint = None):
    thisService = configs["thisService"]
    if endpoint == None:
        graphDBURL = "ws://" + libconf.getAddressForService("gremlinserver") + ":8182/gremlin"
    else:
        graphDBURL = "ws://" + endpoint + ":8182/gremlin"
    graph = Graph()
    remoteConn = DriverRemoteConnection(graphDBURL,'g')

# might need this 
#    remoteConn = DriverRemoteConnection(graphDBURL,'g', transport_factory=lambda:AiohttpTransport(call_from_event_loop=True))

    g = graph.traversal().withRemote(remoteConn)

    try:
        log("Connecting to graph DB...")
    except Exception as e:
        log("Could not connect to graph DB: " + str(e))
        return None
    log("Connected to graph DB.")
    return { "g": g, "remoteConn": remoteConn }

def closeGraphDBConnection(context = None):
    if context == None:
        return
    try:
        if "remoteConn" in context:
            log("Closing graph DB connection...")
            context["remoteConn"].close()
            log("Graph DB connection closed.")
    except Exception as e:
        log("Could not close connection to graph DB: " + str(e))
    return
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

import libconf

libconf.init()

import liblogging
import libinfrastructure
import libutil

from cassandra.cluster import Cluster, GraphExecutionProfile, EXEC_PROFILE_GRAPH_DEFAULT, EXEC_PROFILE_GRAPH_SYSTEM_DEFAULT
from cassandra.graph import GraphOptions, GraphProtocol, graph_graphson3_row_factory
from cassandra.datastax.graph.fluent import DseGraph

logger = liblogging.Logger('graphdb-connections')
log = logger.log
graphName = libconf.getCompleteAppName().replace("-", "_")

def getGraphContext(cluster):
    try:
        log("Connecting to graph DB...")
        session = cluster.connect()
        g = DseGraph.traversal_source(session)
    except Exception as e:
        log("Could not connect to graph DB: " + str(e))
        return None
    log("Connected to graph DB.")
    return { "g": g, "remoteConn": cluster, "session": session }

def getSystemGraphContext(serverAddress):
    cluster = Cluster([serverAddress])
    return getGraphContext(cluster)

def getAppGraphContext(serverAddress):
    ep = DseGraph.create_execution_profile(graphName, graph_protocol=GraphProtocol.GRAPHSON_3_0)
    #ep = GraphExecutionProfile(row_factory=graph_graphson3_row_factory, graph_options=GraphOptions(graph_protocol=GraphProtocol.GRAPHSON_3_0, graph_name=graphName))
    cluster = Cluster([serverAddress], execution_profiles={EXEC_PROFILE_GRAPH_DEFAULT: ep})
    return getGraphContext(cluster)

def getAppGraphSchemaContext(serverAddress):
    #ep = DseGraph.create_execution_profile(graphName, graph_protocol=GraphProtocol.GRAPHSON_3_0)
    ep = GraphExecutionProfile(row_factory=graph_graphson3_row_factory, graph_options=GraphOptions(graph_protocol=GraphProtocol.GRAPHSON_3_0, graph_name=graphName))
    cluster = Cluster([serverAddress], execution_profiles={EXEC_PROFILE_GRAPH_DEFAULT: ep})
    return getGraphContext(cluster)

def closeGraphContext(context = None):
    if context == None:
        return
    try:
        if "remoteConn" in context:
            log("Closing graph DB connection...")
            context["remoteConn"].shutdown()
            log("Graph DB connection closed.")
    except Exception as e:
        log("Could not close connection to graph DB: " + str(e))
    return

def query_by_string(query, context):
    session = context["session"]
    return session.execute_graph(query)

def createAppGraph(serverAddress):
    systemContext = getSystemGraphContext(serverAddress)
    session = systemContext["session"]
    session.execute_graph("system.graph(name).ifNotExists().create()", {'name': graphName}, execution_profile=EXEC_PROFILE_GRAPH_SYSTEM_DEFAULT)
    closeGraphContext(systemContext)
    log("Graph '" + graphName + "' is available.")

def connectGraphDB(endpoint = None):
    if endpoint == None:
        address = libconf.getAddressForService("gremlinserver")
    else:
        address = endpoint
    return getAppGraphContext(address)

def closeGraphDBConnection(context = None):
    closeGraphContext(context)
    return
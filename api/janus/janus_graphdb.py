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

from gremlin_python import statics
from gremlin_python.structure.graph import Graph
from gremlin_python.process.graph_traversal import __
from gremlin_python.process.strategies import *
from gremlin_python.driver.driver_remote_connection import DriverRemoteConnection
from gremlin_python.process.traversal import T, P, Operator
from fastapi import Request

import liballinit
import libconf
import liblogging
import libinfrastructure
import libfastapi
import libutil
import libcore_lists

import api
import graphdb_connection

logger = liblogging.Logger('graphdb')
log = logger.log
configs = libconf.getLoadedConfigs()
fastAPIApp = libfastapi.getFastAPIApp()

@fastAPIApp.post("/graphdb-query")
async def graphDBQuery(request:Request):
    query = ""
    context = {}
    try:
        data = await request.json()
        logger.setSessionID(libfastapi.getSessionID(data))
        query = data["query"]
        endpoint = data["graphDBEndpoint"]
        traversalDepth = int(data["traversalDepth"])
        maxEdges = int(data["maxEdges"])
        context = graphdb_connection.connectGraphDB(endpoint)
        log("Running graph query: " + query + "...")
        return api.graphDBQueryResponseGenerator(context, query, traversalDepth, maxEdges)
    except Exception as e:
        log("Error running query '" + query + "': " + str(e))
        graphdb_connection.closeGraphDBConnection(context)
        return api.getAPIErrorResponseGenerator(e)

@fastAPIApp.get("/get-graphdb-instances") #, methods=['GET', 'POST'])
@fastAPIApp.post("/get-graphdb-instances") #, methods=['GET', 'POST'])
async def getGraphDBInstances(request:Request):
    try:
        data = await request.json()
        showMessage = False
        if "showMessage" in data:
            showMessage = data["showMessage"]
        logger.setSessionID(libfastapi.getSessionID(data))
        if showMessage:
            log("Enumerating Graph DB instances...")
        params = {
            "MaxRecords": 100
        }
        response = {
            "clusters": [
                {
                    "DBClusterIdentifier": "GDA01",
                    "Engine": "GDA",
                    "Endpoint": libconf.getAddressForService("gremlinserver"),
                    "Status": "available",
                    "DBClusterMembers": {
                        "Endpoint": libconf.getAddressForService("gremlinserver")
                    }
                }
            ],
            "instances": [
                {
                    "DBClusterIdentifier": "GDA01",
                    "Engine": "GDA",
                    "DBInstanceStatus": "available"
                }
            ]
        }
        if showMessage:
            log("Sending Graph DB instances.")
        return api.getAPIResponseGenerator([ response ])
    except Exception as e:
        log("Error getting Graph DB instances: " + str(e))
        return api.getAPIErrorResponseGenerator(e)

@fastAPIApp.post("/explain-query")
async def explainQuery(request:Request):
    query = ""
    context = {}
    try:
        data = await request.json()
        logger.setSessionID(libfastapi.getSessionID(data))
        query = data["query"]
        endpoint = data["graphDBEndpoint"]
        log("Running explain for query '" + query + "'...")
        context = graphdb_connection.connectGraphDB(endpoint)
        result = api.getQueryExplain(context, query)
        log("Done running explain for '" + query + "'.")
        return api.getAPIResponseGenerator([ { "explain": result }])
    except Exception as e:
        log("Error explaining query '" + query + "': " + str(e))
        graphdb_connection.closeGraphDBConnection(context)
        return api.getAPIErrorResponseGenerator(e)

@fastAPIApp.post("/profile-query")
async def profileQuery(request:Request):
    query = ""
    context = {}
    try:
        data = await request.json()
        logger.setSessionID(libfastapi.getSessionID(data))
        query = data["query"]
        endpoint = data["graphDBEndpoint"]
        log("Running profile for query '" + query + "'...")
        context = graphdb_connection.connectGraphDB(endpoint)
        result = api.getQueryProfile(context, query)
        log("Done running profile for '" + query + "'.")
        return api.getAPIResponseGenerator([ { "profile": result }])
    except Exception as e:
        log("Error profiling query '" + query + "': " + str(e))
        graphdb_connection.closeGraphDBConnection(context)
        return api.getAPIErrorResponseGenerator(e)

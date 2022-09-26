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
retryCreateDelaySeconds = 30

def createAppGraphThread():
    serverAddress = libconf.getAddressForService("gremlinserver")
    tryCount = 0
    keepGoing = True
    suppressMessages = False
    while (tryCount < 1000) and (keepGoing == True):
        try:
            if not suppressMessages:
                log("Creating app graph...")
            graphdb_connection.createAppGraph(serverAddress)
            log("Done creating app graph.")
            keepGoing = False
        except Exception as e:
            tryCount = tryCount + 1
            if not suppressMessages:
                log("Failed to create app graph: " + str(e) + ". Trying again soon...")
            suppressMessages = not ((tryCount % 10) == 0)
        time.sleep(retryCreateDelaySeconds)
    return

def createAppGraphOnThread():
    thread = threading.Thread(target = createAppGraphThread, args = [])
    thread.daemon = True
    thread.name = "CreateAppGraphThread"
    thread.start()
    return
    
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

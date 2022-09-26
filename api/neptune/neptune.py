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

logger = liblogging.Logger('neptune')
log = logger.log
configs = libconf.getLoadedConfigs()
fastAPIApp = libfastapi.getFastAPIApp()
neptuneClient = None

def initNeptune():
    global neptuneClient
    if not neptuneClient:
        neptuneClient = boto3.client("neptune")
    return

@fastAPIApp.get("/get-neptune-instances") #, methods=['GET', 'POST'])
@fastAPIApp.post("/get-neptune-instances") #, methods=['GET', 'POST'])
async def getNeptuneInstances(request:Request):
    try:
        initNeptune()
        data = await request.json()
        showMessage = False
        if "showMessage" in data:
            showMessage = data["showMessage"]
        logger.setSessionID(libfastapi.getSessionID(data))
        if showMessage:
            log("Enumerating neptune instances...")
        params = {
            "MaxRecords": 100
        }
        responseClusters = neptuneClient.describe_db_clusters(**params)
        responseInstances = neptuneClient.describe_db_instances(**params)
        response = {
            "clusters": responseClusters["DBClusters"],
            "instances": responseInstances["DBInstances"]
        }
        if showMessage:
            log("Sending neptune instances.")
        return api.getAPIResponseGenerator([ response ])
    except Exception as e:
        log("Error getting neptune instances: " + str(e))
        return api.getAPIErrorResponseGenerator(e)

@fastAPIApp.post("/create-neptune-cluster")
async def createNeptuneCluster(request:Request):
    try:
        data = await request.json()
        logger.setSessionID(libfastapi.getSessionID(data))
        if configs["aws"]["usingAWS"]:
            initNeptune()
            log("Creating neptune cluster...")
            clusterParams = {
                "DBSubnetGroupName": "default-vpc-2c923e48",
                "DBClusterIdentifier": data["name"] + "-cluster-" + libconf.getCompleteAppName(),
                "Engine": "neptune",
                "VpcSecurityGroupIds": configs["aws"]["securityGroups"], 
                "Tags": configs["aws"]["tags"]
            }
            response = neptuneClient.create_db_cluster(**clusterParams)
            log("Sending create cluster response.")
            return api.getAPIResponseGenerator(response)
        else:
            raise Exception("Not using AWS.")
    except Exception as e:
        log("Error creating Neptune cluster: " + str(e))
        return api.getAPIErrorResponseGenerator(e)

@fastAPIApp.post("/create-neptune-instance")
async def createNeptuneInstance(request:Request):
    try:
        data = await request.json()
        logger.setSessionID(libfastapi.getSessionID(data))
        if configs["aws"]["usingAWS"]:
            initNeptune()
            data = await request.json()
            logger.setSessionID(libfastapi.getSessionID(data))
            try:
                log("Attempting to add S3 Loader role to cluster...")
                params = {
                    "DBClusterIdentifier": data["DBClusterIdentifier"],
                    "RoleArn": ""
                }
                response = neptuneClient.add_role_to_db_cluster(**params)        
                log("S3 role successfully added.")
            except Exception as e:
                log("Error adding role: " + str(e))
                log("Could not add S3 role. DB can still be used.")
            log("Creating neptune instance...")
            instanceParams = {
                "DBClusterIdentifier": data["DBClusterIdentifier"],
                "DBInstanceIdentifier": data["DBClusterIdentifier"] + "-main",
                "DBSubnetGroupName": "default-vpc-2c923e48",
                "DBInstanceClass": "db.r4.large",
                "Engine": "neptune",
                "Tags": configs["aws"]["tags"],
                "DBSubnetGroupName": "default-vpc-2c923e48",
                "DBParameterGroupName": "gda2019"
            }
            response = neptuneClient.create_db_instance(**instanceParams)
            log("Sending create instance response.")
            return api.getAPIResponseGenerator(response)
        else:
            raise Exception("Not using AWS.")
    except Exception as e:
        log("Error creating Neptune instance: " + str(e))
        return api.getAPIErrorResponseGenerator(e)

@fastAPIApp.post("/delete-neptune-cluster")
async def deleteNeptuneCluster(request:Request):
    try:
        data = await request.json()
        logger.setSessionID(libfastapi.getSessionID(data))
        if configs["aws"]["usingAWS"]:
            initNeptune()
            data = await request.json()
            logger.setSessionID(libfastapi.getSessionID(data))
            log("Initiating deletion of neptune cluster...")
            params = {
                "MaxRecords": 100
            }
            if not "gda" in data["Endpoint"] and data["Engine"] == "neptune":
                responseInstances = neptuneClient.describe_db_instances(**params)
                for instance in responseInstances["DBInstances"]:
                    if "DBClusterIdentifier" in instance:
                        if instance["DBClusterIdentifier"] == data["DBClusterIdentifier"]:
                            deleteNeptuneInstance(instance, data)
                clusterParams = {
                    "DBClusterIdentifier": data["DBClusterIdentifier"],
                    "SkipFinalSnapshot": True
                }
                response = neptuneClient.delete_db_cluster(**clusterParams)
                log("Sending delete cluster response.")
                return api.getAPIResponseGenerator(response)
            else:
                raise Exception("Can't delete instance.")
        else:
            raise Exception("Not using AWS.")
    except Exception as e:
        log("Error deleting Neptune cluster: " + str(e))
        return api.getAPIErrorResponseGenerator(e)

def deleteNeptuneInstance(instance, cluster):
    log("Initiating deletion of instance: " + instance["DBInstanceIdentifier"])
    initNeptune()
    params = {
        "DBInstanceIdentifier": instance["DBInstanceIdentifier"],
        "SkipFinalSnapshot": True
    }
    if instance["Engine"] == "neptune" and instance["DBClusterIdentifier"] == cluster["DBClusterIdentifier"]:
        response = neptuneClient.delete_db_instance(**params)
    log("Done initiating deletion of instance.")

@fastAPIApp.post("/neptune-explain-query")
async def explainNeptuneQuery(request:Request):
    query = ""
    try:
        initNeptune()
        data = await request.json()
        logger.setSessionID(libfastapi.getSessionID(data))
        query = data["query"]
        url = "https://" + data["neptuneEndpoint"] + ":8182/gremlin/explain"
        log("Running neptune explain for query '" + query + "'...")
        loadConfigs = {
            "gremlin": query
        }
        r = requests.post(url, json=loadConfigs)
        result = r.text
        log("Done running neptune explain for '" + query + "'.")
        return api.getAPIResponseGenerator([ { "explain": result }])
    except Exception as e:
        log("Error explaining query '" + query + "': " + str(e))
        return api.getAPIErrorResponseGenerator(e)

@fastAPIApp.post("/neptune-profile-query")
async def profileNeptuneQuery(request:Request):
    query = ""
    try:
        initNeptune()
        data = await request.json()
        logger.setSessionID(libfastapi.getSessionID(data))
        query = data["query"]
        url = "https://" + data["neptuneEndpoint"] + ":8182/gremlin/profile"
        log("Running neptune profile for query '" + query + "'...")
        loadConfigs = {
            "gremlin": query
        }
        r = requests.post(url, json=loadConfigs)
        result = r.text
        log("Done running neptune profile for '" + query + "'.")
        return api.getAPIResponseGenerator([ { "profile": result }])
    except Exception as e:
        log("Error profiling query '" + query + "': " + str(e))
        return api.getAPIErrorResponseGenerator(e)

@fastAPIApp.post("/neptune-query")
async def neptuneQuery(request:Request):
    query = ""
    context = {}
    try:
        initNeptune()
        data = await request.json()
        logger.setSessionID(libfastapi.getSessionID(data))
        query = data["query"]
        endpoint = data["neptuneEndpoint"]
        traversalDepth = int(data["traversalDepth"])
        maxEdges = int(data["maxEdges"])
        context = neptune_connection.connectNeptune(endpoint)
        log("Running neptune query: " + query + "...")
        return api.neptuneQueryResponseGenerator(context, query, traversalDepth, maxEdges)
    except Exception as e:
        log("Error running query '" + query + "': " + str(e))
        neptune_connection.closeNeptuneConnection(context)
        return api.getAPIErrorResponseGenerator(e)

@fastAPIApp.post("/neptune-load")
async def neptuneLoad(request:Request):
    try:
        initNeptune()
        data = await request.json()
        logger.setSessionID(libfastapi.getSessionID(data))
        s3LoadLocation = data["s3LoadLocation"]
        url = "https://" + data["neptuneEndpoint"] + ":8182/loader"
        arn = data["neptuneARN"]
        priority = data["neptuneLoadPriority"]
        log("Starting neptune load from: " + s3LoadLocation + "...")
        loadConfigs = {
            "source" : s3LoadLocation,
            "format" : "csv",
            "iamRoleArn" : arn, 
            "region" : "us-gov-west-1",
            "failOnError" : "FALSE",
            "parallelism" : priority,
            "updateSingleCardinalityProperties" : "TRUE"
        }
        log("Load URL is: " + url)
        log("Load configs are: " + libutil.toJSON(loadConfigs))
        r = requests.post(url, json=loadConfigs)
        result = r.json()
        log("Result: " + libutil.toJSON(result))
        log("Done starting neptune load.")
        return api.getAPIResponseGenerator([result])
    except Exception as e:
        log("Error starting neptune load: " + str(e))
        return api.getAPIErrorResponseGenerator(e)

@fastAPIApp.post("/neptune-cancel-load")
async def neptuneCancelLoad(request:Request):
    try:
        initNeptune()
        data = await request.json()
        logger.setSessionID(libfastapi.getSessionID(data))
        loadID = data["loadID"]
        url = "https://" + data["neptuneEndpoint"] + ":8182/loader/" + loadID
        log("URL is: " + url)
        r = requests.delete(url)
        result = r.json()
        log("Result: " + libutil.toJSON(result))
        log("Done cancelling neptune load.")
        return api.getAPIResponseGenerator([result])
    except Exception as e:
        log("Error cancelling neptune load: " + str(e))
        return api.getAPIErrorResponseGenerator(e)

@fastAPIApp.post("/neptune-load-status")
async def neptuneLoadStatus(request:Request):
    try:
        initNeptune()
        data = await request.json()
        logger.setSessionID(libfastapi.getSessionID(data))
        loadID = data["loadID"]
        url = "https://" + data["neptuneEndpoint"] + ":8182/loader/" + loadID + "?details=true&errors=true"
        log("Getting neptune load status for: " + loadID + "...")
        r = requests.get(url)
        result = r.json()
        log("Result: " + libutil.toJSON(result))
        return api.getAPIResponseGenerator([result])
    except Exception as e:
        log("Error checking neptune load: " + str(e))
        return api.getAPIErrorResponseGenerator(e)

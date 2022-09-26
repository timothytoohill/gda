import sys

sys.dont_write_bytecode = True
sys.path.append("../libraries")

### Need to move lots of API stuff to libs
#sys.path.append("../api")

import os
import hashlib
import pathlib
import io
import traceback
import uuid
import json
import csv
import boto3
import threading
import _thread
import time
import urllib
import requests

from fastapi import Request
from fuzzywuzzy import fuzz

import liballinit
import libconf
import liblogging
import libinfrastructure
import libfastapi
import libutil
import libcore_lists
import libdb_relational

import api
import accounts
import graphdb_queries
import graphdb_downloads
import graphdb_connection
import neptune

logger = liblogging.Logger('jobs')
log = logger.log
configs = libconf.getLoadedConfigs()
fastAPIApp = libfastapi.getFastAPIApp()
ecsClient = None
tableName = libdb_relational.getAppTableName("jobs", isCore = False)

ownedJob = None
jobThread = None
jobThreadCancel = False
jobLock = threading.Lock()
lastContainerCount = 1

monitorThread = None

skipPropertyNames = ["~id", "~label", "~traverseLevel", "~maxTraverseLevel", "~outV", "~inV"]

erThreads = []
edgesQueueLock = threading.Lock()
edgesQueue = []
edgeCount = 0
highestConfidenceValue = 0

maxEdges = 0
traversalDepth = 0
appendResults = True
query1TotalResults = 0
query2TotalResults = 0
batchCount = 0
threadCount = 0
startTime = time.time()
threshold = 90 #int(job["threshold"])
addEdges = False #bool(job["addEdges"])
bidirectional = True #bool(job["bidirectional"])
batchSize = 1000 #int(job["batchSize"])
query1 = "" #job["query1"]
query2 = "" #job["query2"]
selectedQuery1 = "" #job["selectedQuery1"]
selectedQuery2 = "" #job["selectedQuery2"]
selectedProperty1 = "" #job["selectedProperty1"]
selectedProperty2 = "" #job["selectedProperty2"]
startThreadCount = 5 #int(job["startThreadCount"])
maxThreadCount = 20 #int(job["maxThreadCount"])
threadLeadInTimeSeconds = 10 #int(job["threadLeadInTimeSeconds"])
algorithm = "" #job["algorithm"]
endPointAddress = libconf.getAddressForService("api")
allNodes1 = []
allNodes2 = []

def initECS():
    global ecsClient
    if configs["aws"]["usingAWS"]:
        ecsClient = boto3.client("ecs")

def startMonitorThread():
    global monitorThread
    log("Starting jobs monitor thread...")
    monitorThread = threading.Thread(target=monitorThread, args = [])
    monitorThread.daemon = True
    monitorThread.start()
    log("Jobs monitor thread started.")
    return

def monitorThread():
    global ownedJob
    global lastContainerCount
    containerCheckLoopCount = 0
    while True:
        try:
            log("Running job loop...", "debug")
            service = None
            if containerCheckLoopCount % lastContainerCount == 0:
                containerCheckLoopCount = 0
                log("Getting service info...", "debug")
                service = getServiceInfo()
                if service == None:
                    log("Could not get service info. Cannot control cluster.")
                else:
                    lastContainerCount = service["desiredCount"]
            variables = {
            }
            query = "SELECT * FROM {tableName}".format(tableName=tableName)
            response = None
            for oneResponse in libdb_relational.executeClientSideQuery(query, variables):
                if response == None:
                    response = oneResponse
            if response == None:
                pass #log("Could not get jobs from DB.")
            else:
                startedJobs = []
                results = response["results"]
                for result in results:
                    if not result == None:
                        job = json.loads(result["data"])
                        if job["state"] == "started":
                            startedJobs.append(job)
                if not service == None:
                    requiredContainerCount = 1
                    if len(startedJobs) > requiredContainerCount:
                        requiredContainerCount = len(startedJobs)
                    containerCount = service["desiredCount"]
                    if not containerCount == requiredContainerCount:
                        log("Adjusting cluster 'desiredCount' from " + str(containerCount) + " to " + str(requiredContainerCount) + "...")
                        params = {
                            "cluster": service["clusterArn"],
                            "service": service["serviceName"],
                            "desiredCount": requiredContainerCount
                        }
                        ecsClient.update_service(**params) 
                    lastContainerCount = requiredContainerCount
                if ownedJob == None:
                    processStartedJobs(startedJobs)
                else:
                    handleOwnedJobStatus(startedJobs)
            log("Job loop complete.", "debug")
        except Exception as e:
            log("Error in monitor job loop: " + str(e))
        containerCheckLoopCount += 1
        time.sleep(60)

def exitAsGracefullyAsPossible():
    global ownedJob
    global lastContainerCount
    global jobThreadCancel
    global jobThread
    global jobLock
    exitAfterOwning = False
    jobThreadCancel = True
    if ownedJob == None:
        pass
    else:
        ownedJob = None
        exitAfterOwning = True
    if jobThread == None:
        pass
    else:
        if jobThread.ident == threading.current_thread().ident:
            pass
        else:
            log("Waiting for job thread to finish...")
            jobThread.join(5)
            if libutil.isThreadAlive(jobThread):
                log("Could not end job thread.")
    jobThread = None
    if lastContainerCount > 1 or exitAfterOwning:
        log("Exiting container.", "debug")
        try:
            _thread.interrupt_main()
        except Exception as e:
            log("Could not use threading.currentThread().interrupt_main(): " + str(e), "debug")
        log("Waiting 5 seconds before calling os._exit()...", "debug")
        time.sleep(5)
        try:
            os._exit(os.EX_OK)
        except Exception as e:
            os._exit()
        log("Unable to exit container.")
    return

def handleOwnedJobStatus(startedJobs):
    global ownedJob
    global jobLock
    with jobLock:
        foundJob = None
        if ownedJob == None:
            pass
        else:
            log("Handling owned job status: '" + ownedJob["name"] + "'...", "debug")
            for job in startedJobs:
                if job["name"] == ownedJob["name"]:
                    foundJob = job
                    break
            if foundJob == None:
                log("Job no longer in started state or no longer exists.", "debug")
                setJobStatus(ownedJob, "Cancelled '" + ownedJob["name"] + "'.", True, False)
                exitAsGracefullyAsPossible()
                return
            if foundJob["owner"] == ownedJob["owner"]:
                log("Job still owned by this container and started.", "debug")
                pass
            else:
                log("Job is no longer owned by this container.", "debug")
                exitAsGracefullyAsPossible()
                return
        return
    
def processStartedJobs(startedJobs):
    global ownedJob
    global jobThread
    global jobThreadCancel
    global jobLock
    with jobLock:
        for job in startedJobs:
            if job["owner"] == "":
                ownJob(job)
                break
        if ownedJob == None:
            log("Could not find any jobs to do.", "debug")
            exitAsGracefullyAsPossible()
            return
        jobThreadCancel = False
        if ownedJob["type"] == "graphDBLoad":
            jobThread = threading.Thread(target=processGraphDBLoadJob, args = [ownedJob])
            setJobStatus(job, "Starting graph DB load job...", resetStatusHistory = True)
        elif ownedJob["type"] == "entityResolution":
            jobThread = threading.Thread(target=processEntityResolutionJob, args = [ownedJob])
            setJobStatus(job, "Starting entity resolution job...", resetStatusHistory = True)
        else:
            setJobStatus(job, "Not a currently supported job type.")
            stopJob(job)
            exitAsGracefullyAsPossible()
            return
        jobThread.daemon = True
        jobThread.start()
        return

def processEntityResolutionJob(job):
    global jobThreadCancel
    global jobLock
    global edgesQueue
    global edgesQueueLock
    global edgeCount
    global highestConfidenceValue

    global threshold, addEdges, bidirectional, batchSize, query1, query2, selectedQuery1, selectedQuery2, selectedProperty1, selectedProperty2, startThreadCount, maxThreadCount, threadLeadInTimeSeconds, algorithm, endPointAddress
    global query1TotalResults, query2TotalResults, batchCount, edgesQueueCount

    global allNodes1, allNodes2

    try:
        erThreads = []
        edgesQueue = []
        edgeCount = 0
        highestConfidenceValue = 0

        setJobStatus(job, "Connecting to source graph DB instance..", True, False)
        sourceContext1 = graphdb_connection.connectGraphDB(job["sourceInstance"])
        if sourceContext1 == None:
            setJobStatus(job, "Could not connect to source graph DB instance.")
            stopJob(job)
            exitAsGracefullyAsPossible()
            return
        sourceContext2 = graphdb_connection.connectGraphDB(job["sourceInstance"])
        if sourceContext2 == None:
            setJobStatus(job, "Could not connect to source graph DB instance.")
            stopJob(job)
            exitAsGracefullyAsPossible()
            return
        edgesContext = graphdb_connection.connectGraphDB(job["sourceInstance"])
        if edgesContext == None:
            setJobStatus(job, "Could not connect to source graph DB instance.")
            stopJob(job)
            exitAsGracefullyAsPossible()
            return

        if "computeClusterEndpoint" in job:
            endPointAddress = job["computeClusterEndpoint"]

        def setProperties(job):
            global threshold, addEdges, bidirectional, batchSize, query1, query2, selectedQuery1, selectedQuery2, selectedProperty1, selectedProperty2, startThreadCount, maxThreadCount, threadLeadInTimeSeconds, algorithm, endPointAddress
            threshold = int(job["threshold"])
            addEdges = bool(job["addEdges"])
            bidirectional = bool(job["bidirectional"])
            batchSize = int(job["batchSize"])
            query1 = job["query1"]
            query2 = job["query2"]
            selectedQuery1 = job["selectedQuery1"]
            selectedQuery2 = job["selectedQuery2"]
            selectedProperty1 = job["selectedProperty1"]
            selectedProperty2 = job["selectedProperty2"]
            startThreadCount = int(job["startThreadCount"])
            maxThreadCount = int(job["maxThreadCount"])
            threadLeadInTimeSeconds = int(job["threadLeadInTimeSeconds"])
            algorithm = job["algorithm"]
            endPointAddress = libconf.getAddressForService("compute") 
            if "computeClusterEndpoint" in job:
                endPointAddress = job["computeClusterEndpoint"]

        def getProperties():
            global threshold, addEdges, bidirectional, batchSize, query1, query2, selectedQuery1, selectedQuery2, selectedProperty1, selectedProperty2, startThreadCount, maxThreadCount, threadLeadInTimeSeconds, algorithm, endPointAddress
            global query1TotalResults, query2TotalResults, batchCount, edgesQueueCount
            global allNodes1, allNodes2
            edgesQueueLen = 0
            with edgesQueueLock:
                edgesQueueLen = len(edgesQueue)
            threads = manageThreads()
            properties = {}
            properties["query1TotalNodes"] = len(allNodes1)
            properties["query2TotalNodes"] = len(allNodes2)
            properties["threadCount"] = len(threads)
            properties["query1TotalNodesProcessed"] = query1TotalResults
            properties["query2TotalNodesProcessed"] = query2TotalResults
            properties["totalNodePropertyComparisons"] = query1TotalResults * query2TotalResults
            properties["batchCount"] = batchCount
            properties["edgesQueueCount"] = edgesQueueLen
            properties["totalSeconds"] = time.time() - startTime
            properties["edgeCount"] = edgeCount
            properties["highestConfidenceValue"] = highestConfidenceValue
            properties["lastUpdateTime"] = time.time()
            properties["algorithm"] = algorithm
            properties["computeClusterEndpoint"] = endPointAddress
            properties["threshold"] = threshold
            properties["startThreadCount"] = startThreadCount
            properties["maxThreadCount"] = maxThreadCount
            properties["threadLeadInTimeSeconds"] = threadLeadInTimeSeconds
            properties["addEdges"] = addEdges
            return properties

        def updateStatus(overwrite = True):
            updateJob = getJob(job["name"])
            setProperties(updateJob)
            properties = getProperties()
            setJobStatus(job, "Query 1 Nodes: " + str(query1TotalResults) + "; Query 2 Nodes: " + str(query2TotalResults) + "; Edges: " + str(edgeCount), True, True, properties, False, overwrite)

        setProperties(job)

        query1TotalResults = 0
        query2TotalResults = 0
        batchCount = 0
        threadCount = 0
        startTime = time.time()

        eqt = threading.Thread(target=edgesQueueThread, args = [edgesContext, addEdges, bidirectional, selectedProperty1, selectedProperty2])
        eqt.daemon = True
        eqt.start()

        allNodes1 = []
        allNodes2 = []

        properties = getProperties()

        n1 = threading.Thread(target=api.getNodeIteratorNodeIDs, args = [sourceContext1, query1, allNodes1])
        n1.daemon = True
        n1.start()
        setJobStatus(job, "Waiting to get first set of nodes...", properties = properties)

        n2 = threading.Thread(target=api.getNodeIteratorNodeIDs, args = [sourceContext2, query2, allNodes2])
        n2.daemon = True
        n2.start()
        setJobStatus(job, "Waiting to get second set of nodes...", properties = properties)

        n1.join()
        n2.join()

        setJobStatus(job, "Performing O(n*n) ER job: '" + query1 + "': (" + str(len(allNodes1)) + "); '" + query2 + "': (" + str(len(allNodes2)) + ")...", properties = properties)

        updateStatus(False)

        nodes1 = []
        for r1 in api.graphDBQuery(sourceContext1, query1, allNodes1, traversalDepth, maxEdges):
            if jobThreadCancel:
                raise Exception("Cancelled.")
            if "node" in r1:
                query1TotalResults += 1
                if selectedProperty1 in r1["node"]:
                    nodes1.append({ "id": r1["node"]["~id"], "value": r1["node"][selectedProperty1]})
            if len(nodes1) >= batchSize or "end" in r1:
                updateStatus()
                nodes2 = []
                for r2 in api.graphDBQuery(sourceContext2, query2, allNodes2, traversalDepth, maxEdges):
                    if jobThreadCancel:
                        raise Exception("Cancelled.")
                    if "node" in r2:
                        query2TotalResults += 1
                        if selectedProperty2 in r2["node"]:
                            nodes2.append({ "id": r2["node"]["~id"], "value": r2["node"][selectedProperty2]})
                    if len(nodes2) >= batchSize or "end" in r2:
                        batchCount += 1
                        processERBatch(algorithm, nodes1, nodes2, startThreadCount, maxThreadCount, threadLeadInTimeSeconds, threshold, bidirectional, endPointAddress)
                        nodes2 = []
                        updateStatus()
                nodes1 = []
                updateStatus()
        waitCount = 0
        setJobStatus(job, "Waiting for edges and compute threads to finish...", properties = properties)
        while not jobThreadCancel:
            sleepIt = False
            with edgesQueueLock:
                if len(edgesQueue) > 0:
                    sleepIt = True
                else:
                    threads = manageThreads()
                    if len(threads) > 0:
                        sleepIt = True
                    else:
                        break
            if sleepIt:
                waitCount += 1
                time.sleep(1)
            if waitCount % 10 == 0:
                properties = getProperties()
                setJobStatus(job, "Waiting for edges and compute threads to finish...", True, True, properties, False, True)
        endTime = time.time()
        properties = getProperties()
        setJobStatus(job, "Query 1 Nodes: " + str(query1TotalResults) + "; Query 2 Nodes: " + str(query2TotalResults), properties = properties)
        setJobStatus(job, "Completed ER job.", properties = { "totalSeconds": endTime - startTime, "edgeCount": edgeCount })
    except Exception as e:
        log("Error processing ER job: " + str(e))
        print(traceback.format_exc())
        setJobStatus(job, "Error processing ER job: " + str(e), False)
    stopJob(job)
    graphdb_connection.closeGraphDBConnection(sourceContext1)
    graphdb_connection.closeGraphDBConnection(sourceContext2)
    graphdb_connection.closeGraphDBConnection(edgesContext)
    if not jobThreadCancel:
        with jobLock:
            exitAsGracefullyAsPossible()
    return

def processERBatch(algorithm, nodes1, nodes2, startThreadCount, maxThreadCount, threadLeadInTimeSeconds, threshold, bidirectional, endPointAddress):
    global jobThreadCancel
    startTime = time.time()
    while not jobThreadCancel:
        threads = manageThreads()
        if len(threads) >= maxThreadCount:
            time.sleep(1)
            continue
        while threadLeadInTimeSeconds > time.time() - startTime and not jobThreadCancel and len(threads) > startThreadCount:
            time.sleep(1)
            continue
        if not jobThreadCancel:
            t = threading.Thread(target=erBatchThread, args = [algorithm, nodes1, nodes2, threshold, bidirectional, endPointAddress])
            t.daemon = True
            threads.append(t)
            t.start()
        break

def erBatchThread(algorithm, nodes1, nodes2, threshold, bidirectional, endPointAddress):
    global edgesQueue
    try:
        batch = { "algorithm": algorithm, "nodes1": nodes1, "nodes2": nodes2, "threshold": threshold }
        url = "http://" + endPointAddress + ":" + str(configs["appServices"]["api"]["port"]) + "/compute"
        r = requests.post(url, json=batch, timeout=60*60)
        response = r.json()
        if "responses" in response:
            edges = response["responses"]
            for edge in edges:
                while True:
                    queueLen = 0
                    with edgesQueueLock:
                        queueLen = len(edgesQueue)
                    if queueLen >= 100000 - 1:
                        time.sleep(1)
                        continue
                    with edgesQueueLock:
                        edgesQueue.append(edge)
                        if bidirectional:
                            otherWay = {}
                            libutil.mergeDictionaries(edge, otherWay)
                            otherWay["from"] = edge["to"]
                            otherWay["to"] = edge["from"]
                            edgesQueue.append(otherWay)
                    break
        else:
            log("Response did not contain edges. Might be an exception. " + libutil.toJSON(response))
    except Exception as e:
        log("Error in ER batch thread. Batch is lost: " + str(e))
    return

def edgesQueueThread(context, addEdges, bidirectional, property1, property2):
    global edgesQueue
    global edgeCount
    global highestConfidenceValue
    log("Edges queue thread started.")
    while not jobThreadCancel:
        notEmpty = False
        with edgesQueueLock:
            if len(edgesQueue) > 0:
                edge = edgesQueue.pop(0)
                addEdge(context, edge, addEdges, property1, property2)
                if edge["confidence"] > highestConfidenceValue:
                    highestConfidenceValue = edge["confidence"]
                edgeCount = edgeCount + 1
                notEmpty = True
        if notEmpty:
            pass
        else:
            time.sleep(1)
        continue
    log("Edges queue thread ending.")

def addEdge(context, edge, addEdges, property1, property2):
    g = context["g"]
    id = libutil.getHash256(edge["from"] + edge["to"] + edge["algorithm"])
    try:
        g.E(id).drop().iterate()
    except Exception as e:
        pass
    if addEdges:
        g.V(edge["from"]).addE(edge["algorithm"]).property(T.id, id).property("property1", property1).property("property2", property2).property("confidence", edge["confidence"]).to(g.V(edge["to"])).iterate()

def manageThreads():
    global erThreads
    newThreads = []
    for thread in erThreads:
        if libutil.isThreadAlive(thread):
            newThreads.append(thread)
    erThreads = newThreads
    return erThreads

def processGraphDBLoadJob(job):
    global jobThreadCancel
    global jobLock
    sourceContext = None
    destContext = None
    try:
        setJobStatus(job, "Connecting to source graph DB instance..", True, False)
        sourceContext = graphdb_connection.connectGraphDB(job["sourceInstance"])
        if sourceContext == None:
            setJobStatus(job, "Could not connect to source graph DB instance.")
            stopJob(job)
            exitAsGracefullyAsPossible()
        setJobStatus(job, "Connecting to destination graph DB instance...", True, False)    
        destContext = graphdb_connection.connectGraphDB(job["destInstance"])
        if destContext == None:
            setJobStatus(job, "Could not connect to destination graph DB instance.")
            stopJob(job)
            exitAsGracefullyAsPossible()
        maxEdges = 10
        traversalDepth = 1
        appendResults = True
        query1 = job["query1"]
        selectedQuery1 = job["selectedQuery1"]
        useHistory1 = job["useHistory1"]
        useSelectedQuery1 = False
        if not selectedQuery1 == None:
            if "query" in selectedQuery1:
                if query1 == selectedQuery1["query"]:
                    useSelectedQuery1 = True
        queryObject = { "query": query1, "traversalDepth": traversalDepth, "maxEdges": maxEdges, "appendResults": appendResults }
        queries = [ queryObject ]
        if useSelectedQuery1:
            if useHistory1:
                queries = []
                for history in selectedQuery1["queryHistory"]:
                    queries.append(history)
            else:
                queries = [ selectedQuery1 ]
        count = 1
        totalResults = 0
        edgeCount = 0
        nodeCount = 0
        for queryObj in queries:
            query = queryObj["query"]
            traversalDepth = int(queryObj["traversalDepth"])
            maxEdges = int(queryObj["maxEdges"])
            appendResults = bool(queryObj["appendResults"])
            if appendResults:
                message = "with a traversal depth of " + str(traversalDepth) + " and max edges set to " + str(maxEdges)
                setJobStatus(job, "Performing load for query '" + query + "' (" + str(count) + "/" + str(len(queries)) + ") " + message + "...")
                for result in api.graphDBQuery(sourceContext, query, traversalDepth, maxEdges):
                    totalResults += 1
                    if "node" in result:
                        nodeCount += 1
                        handleNewNode(destContext, result["node"])
                    elif "edge" in result:
                        edgeCount += 1
                        handleNewEdge(destContext, result["edge"])
                    if jobThreadCancel:
                        raise Exception("Cancelled. " + "Nodes: " + str(nodeCount) + "; Edges: " + str(edgeCount))
                    if totalResults % 1000 == 0:
                        properties = {}
                        properties["nodeCount"] = nodeCount
                        properties["edgeCount"] = edgeCount
                        properties["currentQuery"] = query
                        setJobStatus(job, "Nodes: " + str(nodeCount) + "; Edges: " + str(edgeCount), properties = properties)
            else:
                setJobStatus(job, "Ignoring query '" + query + "' due to not having 'Append' selected.")
            count += 1
        setJobStatus(job, "Completed graph DB load. " + "Nodes: " + str(nodeCount) + "; Edges: " + str(edgeCount))
    except Exception as e:
        log("Error processing graph DB load job: " + str(e))
        setJobStatus(job, "Error processing graph DB load job: " + str(e), False)
    stopJob(job)
    graphdb_connection.closeGraphDBConnection(sourceContext)
    graphdb_connection.closeGraphDBConnection(destContext)
    if not jobThreadCancel:
        with jobLock:
            exitAsGracefullyAsPossible()
        return

def handleNewNode(context, node):
    g = context["g"]
    query = None
    try:
        g.V(node["~id"]).drop().iterate()
    except Exception as e:
        pass
    query = g.addV(node["~label"][0]).property(T.id, node["~id"])
    query = addProperties(query, node)
    query.iterate()
    return

def handleNewEdge(context, edge):
    g = context["g"]
    try:
        g.E(edge["~id"]).drop().iterate()
    except Exception as e:
        pass
    fromV = g.V(edge["~outV"])
    toV = g.V(edge["~inV"])
    query = fromV.addE(edge["~label"][0]).property(T.id, edge["~id"])
    query = addProperties(query, edge)
    query = query.to(toV)
    query.iterate()
    return

def addProperties(query, nodeOrEdge):
    q = query
    for propertyName in nodeOrEdge:
        if not propertyName in skipPropertyNames:
            for propertyValue in nodeOrEdge[propertyName]:
                q = q.property(propertyName, propertyValue)
    return q

def stopJob(jobObj):
    job = getJob(jobObj["name"])
    job["state"] = "stopped"
    saveJob(job, False)

def setJobStatus(jobObj, status, logIt = True, debug = True, properties = None, resetStatusHistory = False, overwriteLastHistory = False):
    job = getJob(jobObj["name"])
    if resetStatusHistory:
        job["statusHistory"] = []
    histLen = len(job["statusHistory"])
    if overwriteLastHistory and histLen > 0:
        job["statusHistory"][histLen - 1] = status
    else:
        job["statusHistory"].append(status)
    if properties == None:
        pass
    else:
        for propertyName in properties:
            job[propertyName] = properties[propertyName]
    job["status"] = status
    if logIt:
        if debug:
            log(status, "debug")
        else:
            log(status)
    saveJob(job, False)

def ownJob(job):
    global ownedJob
    job["owner"] = libutil.getThisInstanceID()
    saveJob(job, False)
    ownedJob = job
    
def getServiceInfo():
    sName = configs["thisService"]
    service = configs["appServices"][sName]
    serviceName = libconf.generateCompleteAppServiceName(sName, configs)
    if configs["aws"]["usingAWS"]:
        sresponse = { "services": [] }
        try:
            sresponse = ecsClient.describe_services(cluster = serviceName, services = [serviceName])
        except Exception as e:
            log("Unable to describe service '" + serviceName + ": " + str(e))
        if len(sresponse["services"]) > 0:
            if sresponse["services"][0]["status"] in ["ACTIVE"]:
                log("Service '" + serviceName + "' exists (" + sresponse["services"][0]["status"] + "), so returning...", "debug")
                return sresponse["services"][0]
    return None

def getJob(name):
    variables = {
        "name": name
    }
    query = "SELECT * FROM {tableName} WHERE name = %(name)s".format(tableName=tableName)
    jobObj = None
    for response in libdb_relational.executeClientSideQuery(query, variables):
        for result in response["results"]:
            jobObj = json.loads(result["data"])
            break
    return jobObj

def saveJob(job, withResponse = True):
    name = job["name"]
    data = ""
    if "data" in job:
        job["data"]["name"] = name
        data = libutil.toJSON(job["data"])
    else:
        data = libutil.toJSON(job)
    #log("Adding/updating job '" + name + "'.")
    variables = {
        "name": name
    }
    query = "SELECT * FROM {tableName} WHERE name = %(name)s".format(tableName=tableName)
    exists = False
    for result in libdb_relational.executeClientSideQuery(query, variables):
        if result["isSuccess"] and result["rowCount"] > 0:
            exists = True
    variables = {
        "name": name,
        "data": data
    }
    if exists:
        query = "UPDATE {tableName} SET data = %(data)s WHERE name = %(name)s".format(tableName=tableName)
    else:
        query = "INSERT INTO {tableName} (name, data) VALUES (%(name)s, %(data)s)".format(tableName=tableName)
    if withResponse:
        return api.clientSideQuery(query, variables)
    else:
        for x in libdb_relational.executeClientSideQuery(query, variables):
            pass

@fastAPIApp.post("/get-jobs")
async def getJobs(request:Request):
    try:
        data = await request.json()
        logger.setSessionID(libfastapi.getSessionID(data))
        variables = {
        }
        query = "SELECT * FROM {tableName} ORDER BY name".format(tableName=tableName)
        log("Sending jobs.")
        return api.clientSideQuery(query, variables)
    except Exception as e:
        log("Error: " + str(e))
        return api.getAPIErrorResponseGenerator(e)

@fastAPIApp.post("/upsert-job")
async def upsertJob(request:Request):
    try:
        data = await request.json()
        logger.setSessionID(libfastapi.getSessionID(data))
        return saveJob(data)
    except Exception as e:
        log("Error: " + str(e))
        return api.getAPIErrorResponseGenerator(e)

@fastAPIApp.post("/delete-job")
async def deleteJob(request:Request):
    try:
        data = await request.json()
        logger.setSessionID(libfastapi.getSessionID(data))
        log("Deleting job.")
        name = data["name"]
        variables = {
            "name": name
        }
        query = "DELETE FROM {tableName} WHERE name = %(name)s".format(tableName=tableName)
        return api.clientSideQuery(query, variables)
    except Exception as e:
        log("Error: " + str(e))
        return api.getAPIErrorResponseGenerator(e)

initECS()
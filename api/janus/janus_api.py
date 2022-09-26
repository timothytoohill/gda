import sys

sys.dont_write_bytecode = True

import liballinit
import libconf
import libdb_relational
import libutil 
import liblogging
import traceback

from gremlin_python.process.traversal import T, P, Operator

import graphdb_connection

logger = liblogging.Logger('main')
log = logger.log
configs = libconf.getLoadedConfigs()

def init():
    libdb_relational.initServiceScripts(configs["thisService"])

def getQueryProfile(context, query):
    g = context["g"]
    query = query + ".profile().toList()"
    result = eval(query)
    return result

def getQueryExplain(context, query):
    g = context["g"]
    query = query + ".explain().toList()"
    return "Explain coming soon."

def graphDBQueryResponseGenerator(context, query, traversalDepth = 1, maxEdges = -1):
    def generate():
        isFirst = True
        try:
            log("Streaming results...")
            yield getAPIJSONResponseHeader()
            for result in graphDBQuery(context, query, traversalDepth, maxEdges):
                if isFirst:
                    pass
                else:
                    yield getAPIJSONResponseSeparator()
                isFirst = False
                yield libutil.toJSON(buildAPIResponse([result]))
            yield getAPIJSONResponseFooter()
            log("Response complete.")
        except Exception as e:
            log("Error (line " + str(sys.exc_info()[-1].tb_lineno) + "): " + str(e))
            print(traceback.format_exc())
            if not isFirst:
                yield getAPIJSONResponseSeparator()
            yield libutil.toJSON(getAPIErrorResponse(e))
            yield getAPIJSONResponseFooter()
        graphdb_connection.closeGraphDBConnection(context)
        log("Done streaming results.")
    return StreamingResponse(generate(), media_type="application/json")

def graphDBQueryDownloadGenerator(context, queryData):
    queryName = queryData["queryName"]
    filename = queryName + ".json"
    runAllHistoryForDownload = queryData["runAllHistoryForDownload"]
    queries = [ queryData ]
    if runAllHistoryForDownload:
        queries = []
        queryHistory = queryData["queryHistory"]
        for query in queryHistory:
            queries.append(query)
    def generate():
        isFirst = True
        try:
            log("Streaming download...")
            yield getAPIJSONDownloadResponseHeader()
            count = 1
            for queryObj in queries:
                query = queryObj["query"]
                traversalDepth = int(queryObj["traversalDepth"])
                maxEdges = int(queryObj["maxEdges"])
                appendResults = bool(queryObj["appendResults"])

                message = "with a traversal depth of " + str(traversalDepth) + " and max edges set to " + str(maxEdges)
                log("Streaming download for query '" + query + "' (" + str(count) + "/" + str(len(queries)) + ") " + message + "...")
                for result in graphDBQuery(context, query, traversalDepth, maxEdges):
                    if isFirst:
                        pass
                    else:
                        yield getAPIJSONDownloadResponseSeparator()
                    isFirst = False
                    yield libutil.toJSON(result)
                    
            yield getAPIJSONDownloadResponseFooter()
            log("Done streaming download.")
        except Exception as e:
            log("Error: " + str(e))
            if not isFirst:
                yield getAPIJSONDownloadResponseSeparator()
            yield libutil.toJSON(getAPIErrorResponse(e))
            yield getAPIJSONDownloadResponseFooter()
        graphdb_connection.closeGraphDBConnection(context)
    return StreamingResponse(generate(), headers={"Content-Type": "application/octet-stream", "Content-Disposition": "attachment;filename=" + filename})

def graphDBQuery(context, query, traversalDepth = 1, maxEdges = -1):
    g = context["g"]
    if "inV" in query or "bothE" in query:
        log("Found inV(), outV(), or bothE() in query '" + query + "'. Any query involving an enumeration of in-bound or out-bound edges might not be performant, unless it is sufficiently constrained.")
        #log("See here for Neptune documentation about how the quad elements are indexed: <a href='https://docs.aws.amazon.com/neptune/latest/userguide/feature-overview-data-model.html' target='_blank'>Neptune Graph Data Model</a>.")
        #log("Recommend adding edges so that each node is connected bi-directionally. Traversal queries will be more performant with bi-directional edges and the exclusive use of outE().")
        #log("For automatic traversals, the Mortal Mint server only enumerates out-bound edges at each depth of traversal.")
        #log("However, the first query supplied (i.e. '" + query + "') is always run with no restrictions. ")
    if "drop()" in query:
        raise Exception("The drop() query is not allowed at this time.")
        return
    log("Creating query iterator...")
    mainIterator = eval(query)
    log("Query string successfully returned iterator.")
    iterators = [ mainIterator ]
    canVMResult = canValueMapQuery(g, query)
    canValueMap = canVMResult["canValueMap"]
    vmresult = canVMResult["result"]
    isEQuery = False
    isPQuery = False
    if canValueMap:
        isEQuery = isEdgeQuery(g, query)
        if isEQuery:
            log("Detected that this is an edge query. Getting vertices before traversal...")
            iterator1 = eval(query)
            iterator2 = eval(query)
            iterators = [ iterator1.inV(), iterator2.outV() ]
        else:
            isPQuery = isPathQuery(g, query)
            if isPQuery:
                log("Detected that this is a path query.")
    else:
        log("Cannot valueMap() query. This query does not return nodes or edges.")
        yield {"value": vmresult}
        return
    globalNodeIDs = {}
    nextNodeIDs = {}
    tempNodeIDs = {}
    sentInitialEdges = False
    for iterator in iterators:
        if isPQuery:
            for result in graphDBPathIterator(g, iterator):
                if "node" in result:
                    nodeID = result["node"]["~id"]
                    if not nodeID in globalNodeIDs:
                        yield result
                        nextNodeIDs[nodeID] = nodeID
                        globalNodeIDs[nodeID] = nodeID
                elif "edge" in result:
                    e = result["edge"]
                    if e["~inV"] in globalNodeIDs and e["~outV"] in globalNodeIDs:
                        yield result
        else:
            for result in graphDBNodeIterator(iterator, canValueMap, 0, traversalDepth):
                if canValueMap:
                    nodeID = result["~id"]
                    if not nodeID in globalNodeIDs:
                        yield {"node": result}
                        nextNodeIDs[nodeID] = nodeID
                        globalNodeIDs[nodeID] = nodeID
                else:
                    yield {"value": result}
        if len(nextNodeIDs) > 0 and isEQuery and not sentInitialEdges:
            log("Sending initial edges for edge query...")
            sentInitialEdges = True
            for result in graphDBEdgesIterator(g, mainIterator):
                yield {"edge": result}
        if len(nextNodeIDs) > 0 and traversalDepth > 0:
            for i in range(1, traversalDepth + 1):
                mess = ", with no limit on edge enumeration for each node..."
                if maxEdges >= 0:
                    mess = ", with a maximum of " + str(maxEdges) + " edges to be enumerated for each node..."
                log("Getting nodes and edges for traversal depth " + str(i) + mess)
                for nextNodeID in nextNodeIDs:
                    edgeCount = 0 
                    for result in graphDBEdgesIterator(g, getEdgesQuery(g, nextNodeID, maxEdges)):
                        if maxEdges >= 0:
                            if edgeCount >= maxEdges:
                                log("Max edge count reached for node '" + nextNodeID + "'.")
                                break
                        nodeID = result["~inV"]
                        if not nodeID in globalNodeIDs:
                            for n in graphDBNodeIterator(getNodeQuery(g, nodeID), canValueMap, i, traversalDepth):
                                yield {"node": n}
                            tempNodeIDs[nodeID] = nodeID
                            globalNodeIDs[nodeID] = nodeID
                        yield {"edge": result}
                        edgeCount = edgeCount + 1
                        if edgeCount % 1000 == 0:
                            log("Courtesy warning: enumerated " + str(edgeCount) + " edges for node '" + nextNodeID + "' so far...")
                nextNodeIDs = tempNodeIDs
                tempNodeIDs = {}
    return

def canValueMapQuery(g, query):
    testQuery = query
    testQuery = query + ".limit(1)"
    iterator = eval(testQuery)
    result = None
    try:
        result = str(iterator.next())
        if result[0:2] == "v[" or result[0:2] == "e[" or result[0:5] == "path[":
            return { "canValueMap": True, "result": result }
        else:
            return { "canValueMap": False, "result": result }
    except Exception as e:
        log("Error trying to valueMap: " + str(e))
        return { "canValueMap": False, "result": result }
    return False

def isPathQuery(g, query):
    testQuery = query
    testQuery = query + ".limit(1)"
    iterator = eval(testQuery)
    isPath = False
    try:
        result = str(iterator.next())
        if result[0:5] == "path[":
            isPath = True
    except Exception as e:
        pass
    return isPath

def isEdgeQuery(g, query):
    testQuery = query
    testQuery = query + ".limit(1)"
    iterator = eval(testQuery)
    isEQ = False
    try:
        result = iterator.inV().next()
        isEQ = True
    except Exception as e:
        pass
    return isEQ

def getNodeQuery(g, nodeID):
    return g.V(nodeID)

def getConnectedNodesQuery(g, nodeID):
    return getEdgesQuery(g, nodeID).inV()

def getEdgesQuery(g, nodeID, maxEdges = -1):
    if maxEdges >= 0:
        return g.V(nodeID).outE().limit(maxEdges)
    else:
        return g.V(nodeID).outE()

def graphDBPathIterator(g, iterator):
    edges = []
    while True:
        path = None
        try:
            path = iterator.next()
        except Exception as e:
            break
        if path == None:
            break
        for obj in path:
            objType = str(type(obj))
            if "<class 'gremlin_python.structure.graph.Vertex'>" in objType:
                node = g.V(obj.id).valueMap(True).next()
                node["~traverseLevel"] = 0
                node["~maxTraverseLevel"] = 0
                correctedResult = correctPropertyTypes(node)                
                yield { "node": correctedResult }
            elif "<class 'gremlin_python.structure.graph.Edge'>" in objType:
                edge = g.E(obj.id).valueMap(True).next()
                result = correctPropertyTypes(edge)                
                edgeID = result["~id"]
                inV = g.E(edgeID).inV().id().next()
                outV = g.E(edgeID).outV().id().next()
                result["~outV"] = outV
                result["~inV"] = inV
                edges.append({ "edge": result })
            else:
                log("Unrecognized type in path iterator.")
    for edge in edges:
        yield edge 
    return

def graphDBNodeIterator(iterator, canValueMap = True, traverseLevel = 0, maxTraverseLevel = -1):
    while True:
        result = None
        if canValueMap:
            try:
                result = iterator.valueMap(True).next()
            except Exception as e:
                break
            if result == None:
                return
            if maxTraverseLevel >= 0:
                result["~traverseLevel"] = traverseLevel
                result["~maxTraverseLevel"] = maxTraverseLevel
            else:
                result["~traverseLevel"] = 0
                result["~maxTraverseLevel"] = 0
            correctedResult = correctPropertyTypes(result)                
            yield correctedResult
        else:
            result = iterator.next()
            if result == None:
                return
            yield result
    return

def graphDBEdgesIterator(g, iterator):
    while True:
        result = None
        try:
            result = iterator.valueMap(True).next()
        except Exception as e:
            break
        if result == None:
            return
        else:
            result = correctPropertyTypes(result)
            edgeID = result["~id"]
            inV = g.E(edgeID).inV().id().next()
            outV = g.E(edgeID).outV().id().next()
            result["~outV"] = outV
            result["~inV"] = inV
            yield result
    return

def correctPropertyTypes(valueDict):
    newDict = {}
    for key in valueDict:
        if key == T.label:
            setKeyValue(T.label, valueDict, newDict, "~label")
        elif key == T.id:
            newDict["~id"] = valueDict[key]
        elif not isinstance(key, str):
            setKeyValue(key, valueDict, newDict, str(key))
        else:
            setKeyValue(key, valueDict, newDict)
    return newDict

def setKeyValue(keyName, sourceDict, destDict, newKeyName = None):
    key = keyName
    if newKeyName == None:
        pass
    else:
        key = newKeyName
    if isinstance(sourceDict[keyName], list):
        arr = []
        for vkey in sourceDict[keyName]:
            arr.append(correctStringValue(str(vkey)))
        destDict[key] = arr
    else:
        destDict[key] = [correctStringValue(str(sourceDict[keyName]))]

def correctStringValue(val):
    newVal = val
    if val[0:2] == "b'":
        newVal = val[2:len(val) - 1]
    return newVal

def clientSideQuery(query, variables):
    def generate():
        isFirst = True
        yield getAPIJSONResponseHeader()
        for result in libdb_relational.executeClientSideQuery(query, variables):
            if isFirst:
                pass
            else:
                yield getAPIJSONResponseSeparator()
            yield libutil.toJSON(result)
            isFirst = False
        yield getAPIJSONResponseFooter()
    return StreamingResponse(generate(), media_type="application/json")

def serverSideQuery(query, variables):
    def generate():
        isFirst = True
        yield getAPIJSONResponseHeader()
        for result in libdb_relational.executeServerSideQuery(query, variables):
            if isFirst:
                pass
            else:
                yield getAPIJSONResponseSeparator()
            yield libutil.toJSON(result)
            isFirst = False
        yield getAPIJSONResponseFooter()
    return StreamingResponse(generate(), media_type="application/json")

def getAPIResponseGenerator(results):
    def generate(results):
        yield getAPIJSONResponseHeader()
        yield libutil.toJSON(buildAPIResponse(results))
        yield getAPIJSONResponseFooter()
    return StreamingResponse(generate(), media_type="application/json")

def getAPIErrorResponseGenerator(e):
    def generate(e):
        yield getAPIJSONResponseHeader()
        yield libutil.toJSON(getAPIErrorResponse(e))
        yield getAPIJSONResponseFooter()
    return StreamingResponse(generate(), media_type="application/json")

def getAPIErrorResponse(e):
    apiResponse = getAPIResponseSkeleton()
    apiResponse["isSuccess"] = False
    apiResponse["message"] = getAPIError(e)
    apiResponse["errorDetail"] = traceback.format_exc()
    return apiResponse

def buildAPIResponse(results):
    apiResponse = getAPIResponseSkeleton()
    apiResponse["results"] = results
    return apiResponse

def getAPIError(e):
    return str(e)

def getAPIResponseSkeleton():
    apiResponse = {
        "isSuccess": True,
        "message": "Query executed successfully.",
        "errorDetail": "",
        "results": [{}]
    }
    return apiResponse

def getAPIJSONResponseHeader():
    return "{\n\"responses\": [\n"

def getAPIJSONResponseFooter():
    return "\n]\n}\n"

def getAPIJSONResponseSeparator():
    return ","

def getAPIJSONDownloadResponseHeader():
    return "{\n\"nodesAndEdges\": [\n"

def getAPIJSONDownloadResponseFooter():
    return "\n]\n}\n"

def getAPIJSONDownloadResponseSeparator():
    return ","
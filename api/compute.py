import sys

sys.dont_write_bytecode = True
sys.path.append("../libraries")

### Need to move lots of API stuff to libs
#sys.path.append("../api")

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
import urllib

from fuzzywuzzy import fuzz
from fastapi import Request

import liballinit
import libconf
import liblogging
import libinfrastructure
import libfastapi
import libutil
import libcore_lists
import libdb_relational

import api

logger = liblogging.Logger('compute')
log = logger.log
configs = libconf.getLoadedConfigs()
fastAPIApp = libfastapi.getFastAPIApp()

@fastAPIApp.post("/compute")
async def compute(request:Request):
    try:
        data = await request.json()
        algorithm = data["algorithm"]
        logger.setSessionID(libfastapi.getSessionID(data))
        def generate():
            doneFirst = False
            yield api.getAPIJSONResponseHeader()
            if algorithm == "wratio":
                for edge in processWRatioER(data["nodes1"], data["nodes2"], data["threshold"], algorithm):
                    if doneFirst:
                        yield api.getAPIJSONResponseSeparator()
                    yield libutil.toJSON(edge)
                    doneFirst = True
            elif algorithm == "geoNames":
                log("Running " + algorithm + " ER on " + str(len(data["nodes1"])) + "x" + str(len(data["nodes2"])) + " nodes.")
                for edge in processGeoNamesER(data["nodes1"], data["nodes2"], data["threshold"], algorithm):
                    if doneFirst:
                        yield api.getAPIJSONResponseSeparator()
                    yield libutil.toJSON(edge)
                    doneFirst = True
            else:
                log("Unsupporte algorithm: " + algorithm)
            log("Batch complete.")
            yield api.getAPIJSONResponseFooter()
        return StreamingResponse(generate(), media_type="application/json")
    except Exception as e:
        log("Error processing batch: " + str(e))
        return api.getAPIErrorResponseGenerator(e)

def processWRatioER(nodes1, nodes2, threshold, algorithm):
    comparisons = 0
    results = 0
    perSecond = 0
    startTime = time.time()
    log("Starting compute batch: " + str(len(nodes1)) + " x " + str(len(nodes2)))
    for node1 in nodes1:
        for node2 in nodes2:
            result = fuzzyMatch(node1["value"], node2["value"], threshold)
            comparisons += 1
            if result > 0:
                results += 1
                edge = { "algorithm": algorithm, "from": node1["id"], "to": node2["id"], "confidence": result }
                yield edge
            if comparisons % 100000 == 0:
                totalTime = time.time() - startTime
                perSecond = int(comparisons / totalTime)
                log("Comparisons: " + str(comparisons) + " (" + str(perSecond) + "/s).")
    log("Done. Comparisons: " + str(comparisons) + " (" + str(perSecond) + "/s). Results: " + str(results))

def processGeoNamesER(nodes1, nodes2, threshold, algorithm):
    comparisons = 0
    results = 0
    perSecond = 0
    startTime = time.time()
    log("Starting compute batch: " + str(len(nodes1)) + " x " + str(len(nodes2)))
    for node1 in nodes1:
        for node2 in nodes2:
            result = fuzzyMatch(node1["value"], node2["value"], threshold)
            comparisons += 1
            if result > 0:
                results += 1
                edge = { "algorithm": algorithm, "from": node1["id"], "to": node2["id"], "confidence": result }
                yield edge
            if comparisons % 100000 == 0:
                totalTime = time.time() - startTime
                perSecond = int(comparisons / totalTime)
                log("Comparisons: " + str(comparisons) + " (" + str(perSecond) + "/s).")
    log("Done. Comparisons: " + str(comparisons) + " (" + str(perSecond) + "/s). Results: " + str(results))

def fuzzyMatch(value1, value2, threshold):
    ratio = fuzz.WRatio(value1, value2)
    if ratio >= threshold:
        if 0.5 <= len(value1) / len(value2) <= 1.625:
            return ratio
    return 0


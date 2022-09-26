#!/usr/local/bin/python3

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
import urllib

import liballinit
import libconf
import liblogging
import libinfrastructure
import libdb_relational
import libfastapi
import libutil
import libcore_lists

from fastapi import Request

import api
import accounts
import graphdb_queries
import graphdb_downloads
import graphdb
import neptune

import compute
import jobs

logger = liblogging.Logger('server')
log = logger.log
configs = libconf.getLoadedConfigs()
fastAPIApp = libfastapi.getFastAPIApp()
s3 = None

def initS3():
    global s3
    if not s3:
        s3 = boto3.resource('s3')
    return 

@fastAPIApp.post("/getdoc")
async def getDoc(request:Request):
    try:
        initS3()
        data = await request.json()
        logger.setSessionID(libfastapi.getSessionID(data))
        location = ""
        if isinstance(data["S3Location"], list):
            location = data["S3Location"][0]
        else:
            location = data["S3Location"]
        fcontent = getDocData("s3://" + location)
        jdata = json.loads(fcontent)
        def generate():
            yield api.getAPIJSONResponseHeader()
            yield libutil.toJSON(api.buildAPIResponse([jdata]))
            yield api.getAPIJSONResponseFooter()
        log("Sending source doc.")
        return StreamingResponse(generate(), media_type="application/json")
    except Exception as e:
        log("Error getting doc: " + str(e))
        return api.getAPIErrorResponseGenerator(e)

@fastAPIApp.get("/download-source-doc")
async def downloadDoc(request:Request):
    try:
        initS3()
        data = request.query_params.multi_items()
        data = tuple(data)
        data = dict(data)
        logger.setSessionID(libfastapi.getSessionID(data))
        arr = []
        location = ""
        if isinstance(data["S3Location"], list):
            location = data["S3Location"][0]
        else:
            location = data["S3Location"]
        arr = location.split("/")
        filename = arr[len(arr) - 1]
        fcontent = getDocData("s3://" + location)
        jdata = json.loads(fcontent)
        log("Sending source doc for download.")
        return StreamingResponse(generate(), headers={"Content-Disposition": "attachment;filename=" + filename})
    except Exception as e:
        log("Error getting doc: " + str(e))
        return "Could not get file."    

def getDocData(location):
    initS3()
    log("Getting source doc...")
    log("Source doc S3 location: " + location)
    o = urllib.parse.urlparse(location)
    key = o.path[1:]
    content = s3.Object(o.netloc, key)
    fcontent = content.get()['Body'].read().decode('utf-8')
    return fcontent

graphdb.createAppGraphOnThread()
api.init()

libfastapi.startFastAPIApp()
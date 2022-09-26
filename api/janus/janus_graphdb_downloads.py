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
import graphdb_connection

logger = liblogging.Logger('graphdb-downloads')
log = logger.log
configs = libconf.getLoadedConfigs()
fastAPIApp = libfastapi.getFastAPIApp()

tableName = libdb_relational.getAppTableName("graphdb_downloads", isCore = False)

@fastAPIApp.put("/graphdb-download")
async def createDownload(request:Request):
    try:
        data = await request.json()
        logger.setSessionID(libfastapi.getSessionID(data))
        queryName = data["queryName"]
        queryData = libutil.toJSON(data)
        variables = {
            "queryName": queryName,
            "queryData": queryData
        }
        log("Creating download from query '" + queryName + "'.")
        query = "INSERT INTO {tableName} (name, query) VALUES (%(queryName)s, %(queryData)s) RETURNING id".format(tableName=tableName)
        return api.clientSideQuery(query, variables)
    except Exception as e:
        log("Error: " + str(e))
        return api.getAPIErrorResponseGenerator(e)


@fastAPIApp.get("/graphdb-get-download")
async def getDownload(request:Request):
    context = {}
    try:
        data = request.query_params.multi_items()
        data = tuple(data)
        data = dict(data)
        logger.setSessionID(libfastapi.getSessionID(data))
        id = data["id"]
        variables = {
            "id": id
        }
        log("Getting download '" + id + "'.")
        query = "SELECT * FROM {tableName} WHERE id = %(id)s".format(tableName=tableName)
        record = None
        for response in libdb_relational.executeClientSideQuery(query, variables):
            if response["isSuccess"] and response["rowCount"] > 0:
                record = response["results"][0]
        if record == None:
            log("Could not get download from database.")
            raise Exception("Could not get download from database.")
        queryData = json.loads(record["query"])
        logger.setSessionID(libfastapi.getSessionID(queryData))
        endpoint = queryData["graphDBEndpoint"]
        context = graphdb_connection.connectGraphDB(endpoint)
        return api.graphDBQueryDownloadGenerator(context, queryData)
    except Exception as e:
        log("Error streaming download: " + str(e))
        graphdb_connection.closeGraphDBConnection(context)
        return api.getAPIErrorResponseGenerator(e)

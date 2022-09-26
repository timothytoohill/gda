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

logger = liblogging.Logger('graphdb-queries')
log = logger.log
configs = libconf.getLoadedConfigs()
fastAPIApp = libfastapi.getFastAPIApp()

queriesTableName = libdb_relational.getAppTableName("graphdb_queries", isCore = False)

@fastAPIApp.post("/graphdb-saved-queries")
async def getSavedGraphDBQueries(request:Request):
    try:
        data = await request.json()
        logger.setSessionID(libfastapi.getSessionID(data))
        variables = {
        }
        query = "SELECT * FROM {tableName}".format(tableName=queriesTableName)
        log("Sending saved graph DB queries.")
        return api.clientSideQuery(query, variables)
    except Exception as e:
        log("Error: " + str(e))
        return api.getAPIErrorResponseGenerator(e)

@fastAPIApp.put("/graphdb-saved-query")
async def addGraphDBQuery(request:Request):
    try:
        log("Adding/updating query.")
        data = await request.json()
        logger.setSessionID(libfastapi.getSessionID(data))
        queryName = data["queryName"]
        id = data["id"]
        queryData = libutil.toJSON(data)

        variables = {
            "queryName": queryName
        }
        query = "SELECT * FROM {tableName} WHERE name = %(queryName)s".format(tableName=queriesTableName)
        exists = False
        for result in libdb_relational.executeClientSideQuery(query, variables):
            if result["isSuccess"] and result["rowCount"] > 0:
                exists = True
        if exists:
            variables = {
                "queryName": queryName,
                "queryData": queryData
            }
            query = "UPDATE {tableName} SET query = %(queryData)s WHERE name = %(queryName)s RETURNING id".format(tableName=queriesTableName)
            return api.clientSideQuery(query, variables)
        else:
            variables = {
                "queryName": queryName,
                "queryData": queryData
            }
            query = "INSERT INTO {tableName} (name, query) VALUES (%(queryName)s, %(queryData)s) RETURNING id".format(tableName=queriesTableName)
            return api.clientSideQuery(query, variables)
    except Exception as e:
        log("Error: " + str(e))
        return api.getAPIErrorResponseGenerator(e)

@fastAPIApp.post("/delete-graphdb-saved-query")
async def deleteGraphDBQuery(request:Request):
    try:
        log("Deleting query from saved queries.")
        data = await request.json()
        logger.setSessionID(libfastapi.getSessionID(data))
        queryName = data["queryName"]
        variables = {
            "queryName": queryName
        }
        query = "DELETE FROM {tableName} WHERE name = %(queryName)s".format(tableName=queriesTableName)
        return api.clientSideQuery(query, variables)
    except Exception as e:
        log("Error: " + str(e))
        return api.getAPIErrorResponseGenerator(e)

@fastAPIApp.get("/graphdb-saved-queries-delete-all")
async def deleteSavedGraphDBQueries(request:Request):
    try:
        data = libfastapi.getRequestJSONData()
        logger.setSessionID(libfastapi.getSessionID(data))
        variables = {
        }
        query = "DELETE FROM {tableName}".format(tableName=queriesTableName)
        log("Deleting saved graph DB queries.")
        return api.clientSideQuery(query, variables)
    except Exception as e:
        log("Error: " + str(e))
        return api.getAPIErrorResponseGenerator(e)

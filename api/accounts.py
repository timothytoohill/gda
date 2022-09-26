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

logger = liblogging.Logger('accounts')
log = logger.log
configs = libconf.getLoadedConfigs()
fastAPIApp = libfastapi.getFastAPIApp()

tableName = libdb_relational.getAppTableName("accounts", isCore = False)

@fastAPIApp.post("/accounts")
async def getAccounts(request:Request):
    try:
        data = await request.json()
        logger.setSessionID(libfastapi.getSessionID(data))
        variables = {
        }
        query = "SELECT * FROM {tableName}".format(tableName=tableName)
        log("Getting accounts...")
        return api.clientSideQuery(query, variables)
    except Exception as e:
        log("Error: " + str(e))
        return api.getAPIErrorResponseGenerator(e)

@fastAPIApp.post("/my-account")
async def getAccount(request:Request):
    try:
        data = await request.json()
        logger.setSessionID(libfastapi.getSessionID(data))
        name = data["name"]
        variables = {
            "name": name
        }
        query = "SELECT * FROM {tableName}  WHERE name = %(name)s".format(tableName=tableName)
        log("Getting account '" + name + "'.")
        return api.clientSideQuery(query, variables)
    except Exception as e:
        log("Error: " + str(e))
        return api.getAPIErrorResponseGenerator(e)

@fastAPIApp.post("/save-account") #, methods=['POST', 'PUT'])
@fastAPIApp.put("/save-account") #, methods=['POST', 'PUT'])
async def upsertAccount(request:Request):
    try:
        data = await request.json()
        logger.setSessionID(libfastapi.getSessionID(data))
        name = data["name"]
        log("Adding/updating account '" + name + "'.")
        data = libutil.toJSON(data)
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
            return api.clientSideQuery(query, variables)
        else:
            query = "INSERT INTO {tableName} (name, data) VALUES (%(name)s, %(data)s)".format(tableName=tableName)
            return api.clientSideQuery(query, variables)
    except Exception as e:
        log("Error: " + str(e))
        return api.getAPIErrorResponseGenerator(e)

@fastAPIApp.post("/delete-account")
async def deleteAccount(request:Request):
    try:
        log("Deleting account.")
        data = await request.json()
        logger.setSessionID(libfastapi.getSessionID(data))
        name = data["name"]
        variables = {
            "name": name
        }
        query = "DELETE FROM {tableName} WHERE name = %(name)s".format(tableName=tableName)
        return api.clientSideQuery(query, variables)
    except Exception as e:
        log("Error: " + str(e))
        return api.getAPIErrorResponseGenerator(e)
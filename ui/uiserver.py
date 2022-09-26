#!/usr/local/bin/python3

import sys

sys.dont_write_bytecode = True
sys.path.append("../libraries")
sys.path.append("../api")

import boto3
import uvicorn

import liballinit
import libconf
import liblogging
import libutil 
import libinfrastructure

from fastapi import Request

import libfastapi
import libdb_relational

log = liblogging.Logger('server').log
fastAPIApp = libfastapi.getFastAPIApp()
staticFiles = libfastapi.getStaticFiles()

@fastAPIApp.get("/status")
@fastAPIApp.post("/status")
async def status():
    result = "Ok"
    return libfastapi.buildResponse(result, result == "Ok")

@fastAPIApp.get("/readme")
@fastAPIApp.get("/dashboard")
@fastAPIApp.get("/system/logs/both")
@fastAPIApp.get("/configs")
@fastAPIApp.get("/profiles")
@fastAPIApp.get("/jobs")
@fastAPIApp.get("/graphdb-instances")
async def handleSPARequest():
    return libfastapi.getIndexFileResponse()

fastAPIApp.mount("/", staticFiles, "spa")

libfastapi.startFastAPIApp()
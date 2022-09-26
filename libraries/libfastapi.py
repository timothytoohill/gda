import sys

sys.dont_write_bytecode = True

import os
import json
import fastapi
from fastapi import Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

import libconf
import liblogging
import libinfrastructure
import libutil

log = liblogging.Logger('server').log
staticFilesDir = os.getcwd() + "/dist"
fastAPIApp = None
fastAPIRouter = fastapi.APIRouter()
appConfigs = libinfrastructure.getAppConfigs()

@fastAPIRouter.get("/healthcheck")
@fastAPIRouter.post("/healthcheck")
async def healthCheck():
    return "Good to go!"

@fastAPIRouter.get("/appconfigs")
@fastAPIRouter.post("/appconfigs")
async def getAppConfigs():
    log("Sending app configs.")
    return libutil.toJSON(appConfigs)

@fastAPIRouter.get("/kill")
@fastAPIRouter.post("/kill")
async def kill():
    os._exit(0)

def getSessionID(dataDict):
    if "sessionID" in dataDict:
        return dataDict["sessionID"]
    if "userID" in dataDict:
        return dataDict["userID"]
    return ""
    
def getFastAPIApp():
    global fastAPIApp
    if fastAPIApp == None:
        fastAPIApp = fastapi.FastAPI()
        fastAPIApp.include_router(fastAPIRouter)
        origins = [ "*" ]
        fastAPIApp.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
    return fastAPIApp

def startFastAPIApp():
    fastAPIApp = getFastAPIApp()
    uvicorn.run(fastAPIApp, port = appConfigs["appServices"][libconf.getThisService()]['port'], host = "0.0.0.0")
    return 

def getStaticFilesDir():
    return staticFilesDir

def getStaticFiles():
    staticFiles = StaticFiles(directory = getStaticFilesDir(), html = True)
    return staticFiles

def getIndexFileResponse():
    return FileResponse(getStaticFilesDir() + "/index.html")

def buildResponse(message, ok = True, data = None):
    if data == None:
        data = {}
        
    response = {
        "status": ok,
        "message": message,
        "data": data
    }
    return libutil.toJSON(response)

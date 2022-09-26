import sys

sys.dont_write_bytecode = True

import os
import threading
import time
import psycopg2
import psycopg2.extras
import socket
import contextlib
import boto3

import liballinit
import libconf
import libutil
import liblogging

log = liblogging.Logger('db-relational').log
configs = libconf.getLoadedConfigs()
useRDS = configs["appServices"]["relationaldb"]["useRDS"]
instanceName = libconf.getAppName()
databaseName = libconf.getAppName().replace("-", "_")
initialDatabaseName = configs["appServices"]["relationaldb"]["initialDatabaseName"]
databaseAddress = libconf.getAddressForService("relationaldb") 
databasePort = configs["appServices"]["relationaldb"]["port"]
databaseUsername = "" #configs["appServices"]["relationaldb"]["username"]
databaseUserPassword = "" #configs["appServices"]["relationaldb"]["password"]
buildThread = None
initScriptsDir = os.path.dirname(__file__) + "/sql"
scriptsDir = "./sql"
dbC = None

if useRDS:
    rdsClient = boto3.client('rds')

def initDatabase():
    log("Starting relational database initialization...")
    setCredentials()
    if len(databaseAddress) > 0 and not useRDS:
        buildRelationalDatabase()
    else:
        log("Initializing RDS database...")
        clusterInfo = getRDSDatabaseInstanceInfo()
        if clusterInfo:
            buildRelationalDatabase()
        else:
            log("RDS database not found.")
            clusterInfo = createRDSDatabase()
            if clusterInfo:
                buildRelationalDatabase()
            else:
                return "Failed to create the RDS database."
    log("Relational database initialization has been started.")
    return "Ok"

def setCredentials():
    global databaseUsername
    global databaseUserPassword
    if configs["appServices"]["relationaldb"]["useRDS"]:
        databaseUsername = configs["appServices"]["relationaldb"]["rds"]["username"]
        databaseUserPassword = configs["appServices"]["relationaldb"]["rds"]["password"]
    else:
        databaseUsername = configs["appServices"]["relationaldb"]["username"]
        databaseUserPassword = configs["appServices"]["relationaldb"]["password"]

def waitOnInitialization():
    global buildThread
    bThread = buildThread
    if not bThread == None:
        if libutil.isThreadAlive(bThread):
            if threading.currentThread().ident == bThread.ident:
                return True
            count = 0
            while count < 300 and libutil.isThreadAlive(bThread):
                log("Currently waiting for the relational database become available...")
                bThread.join(15)
                count = count + 1
            bThread = buildThread
            if not bThread == None:
                if libutil.isThreadAlive(bThread):
                    log("Relational database did not initialize.")
                    raise Exception("Relational database did not initialize.")
            log("Relational database finished initializing.")
    return True

def getRDSDatabaseInstanceInfo():
    log("Enumerating RDS instances to find database (" + getClusterName(instanceName) + ")...")
    response = {}
    try:
        response = rdsClient.describe_db_clusters(DBClusterIdentifier = getClusterName(instanceName))
    except Exception as e:
        pass
    if "DBClusters" in response:
        for cluster in response["DBClusters"]:
            if cluster["DBClusterIdentifier"] == getClusterName(instanceName):
                log("Found the RDS database instance (" + getClusterName(instanceName) + "). Status: " + cluster["Status"] + ".")
                return cluster
        log("Could not find the RDS database instance (" + getClusterName(instanceName) + ")")
    else:
        log("Could not enumerate RDS instances.")
    return None

def getClusterName(instanceName):
    return instanceName + "-cluster"

def createRDSDatabase():
    useInstance = False
    log("Creating the RDS database instance (" + instanceName + ") now...")
    clusterParams = {
        "EngineMode": "serverless",
        "Engine": "aurora-postgresql",
        "DatabaseName": databaseName,
        "DBClusterIdentifier": getClusterName(instanceName),
        "VpcSecurityGroupIds": configs["aws"]["securityGroups"], 
        "MasterUsername": databaseUsername, 
        "MasterUserPassword": databaseUserPassword, 
        "DBSubnetGroupName": "default-vpc-2c923e48",
        "Tags": configs["aws"]["tags"],
        "ScalingConfiguration": {
            "MinCapacity": 2,
            "MaxCapacity": 384,
            "AutoPause": True
        }
    }
    instanceParams = {
        "Engine": "aurora-postgresql",
        "DBInstanceIdentifier": instanceName,
        #"DBSubnetGroupName": "default-vpc-2c923e48",
        "DBInstanceClass": "db.r4.xlarge",
        "PubliclyAccessible": False,
        "Tags": configs["aws"]["tags"],
        "DBClusterIdentifier": getClusterName(instanceName)
    }
    response = {}
    if not useInstance:
        try:
            response = rdsClient.create_db_cluster(**clusterParams)
        except Exception as e:
            print(libutil.toJSON(configs))
            log("Error: " + str(e))
            log("Assuming can't create serverless instance. Trying standard...")
            useInstance = True
    if useInstance:
        clusterParams["EngineMode"] = "provisioned"
        del clusterParams["ScalingConfiguration"]
        log("Trying to create cluster...")
        response = rdsClient.create_db_cluster(**clusterParams)
        rdsClient.create_db_instance(**instanceParams)

    if "DBCluster" in response:
        log("Done creating the database (" + instanceName +").")
        return response["DBCluster"]
    else:
        log("Could not create the RDS database (" + instanceName + ").")
    return None

def createLocalRelationalDatabase(autoCommit = True, dbName = None):
    global databaseName
    global databaseAddress
    global databasePort
    global databaseUsername
    global databaseUserPassword
    dName = databaseName
    if dbName:
        dName = dbName
    log("Creating relational DB if needed using: { DBName: " + dName + ", Address: " + databaseAddress + ", Port: " + databasePort + ", Username: " + databaseUsername + ", Password: " + databaseUserPassword + ", autoCommit: " + str(autoCommit) + " }")
    dbConnection = psycopg2.connect(user = databaseUsername, password = databaseUserPassword, host = databaseAddress, port = databasePort)
    dbConnection.autocommit = autoCommit
    dbConnection.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
    log("Checking to see if DB exists and creating if not...")
    with dbConnection.cursor() as cursor:
        sql = "CREATE DATABASE " + dName + ";" #"SELECT 'CREATE DATABASE " + dName + "' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '" + dName + "')\\gexec;"
        try:
            cursor.execute(sql)
        except Exception as e:
            log("Result: " + str(e).strip())
    closeDatabaseConnection(dbConnection)
    log("Done creatiing relational DB if needed.")

def buildRelationalDatabase():
    global buildThread
    log("Initializing relational database...")
    if buildThread:
        log("Connection to the relational database is in progress.")
    else:
        if useRDS:
            buildThread = threading.Thread(target = buildRDSDatabaseThread, args = [])
        else:
            buildThread = threading.Thread(target = buildLocalDatabaseThread, args = [])
        buildThread.daemon = True
        buildThread.start()

def buildRDSDatabaseThread():
    global buildThread
    global databaseAddress
    maxCreateWaitInterval = 300
    for i in range(maxCreateWaitInterval):
        clusterInfo = getRDSDatabaseInstanceInfo()
        if clusterInfo:
            if clusterInfo["Status"] == "creating":
                log("RDS database is currently being created. Waiting " + str(i) + "/" + str(maxCreateWaitInterval) + " times...")
                time.sleep(5)
            elif clusterInfo["Status"] == "deleting":
                log("RDS database is currently being deleted. Cannot connect.")
                break
            elif clusterInfo["Status"] == "available":
                databaseAddress = clusterInfo["Endpoint"]
                log("RDS database endpoint: " + databaseAddress + ".")
                tryToResolveDatabaseHostName(databaseAddress, 300)
                buildRDSDatabase()
                break
            else:
                log("Unknown relational database status: " + clusterInfo["Status"] + ". Failed to connect.")
                break
        else:
            log("RDS database not found. Unable to connect to the database.")
    buildThread = None
    log("Done initializing relational database.")
    return None

def buildLocalDatabaseThread():
    global buildThread
    buildDatabase()
    buildThread = None
    log("Done initializing relational database.")
    return None

def buildRDSDatabase():
    global databaseAddress
    global initialDatabaseName
    try:
        if len(initialDatabaseName) > 0 and not useRDS:
            log("Running pre-initialization script...")
            runDatabaseInitScripts(None, ["init"], isCore = True)
            log("Finished running pre-init script.")
        runDatabaseInitScripts(isCore = True)
    except Exception as e:
        log("Could not run relational database initialization scripts: " + getDBError(e))

def buildDatabase():
    global databaseName
    global databaseAddress
    tryCount = 0
    while tryCount < 200:
        try:
            createLocalRelationalDatabase()
            log("Running pre-initialization script...")
            runDatabaseInitScripts(None, ["init"], isCore = True)
            log("Finished running pre-init script.")
            runDatabaseInitScripts(isCore = True)
            break
        except Exception as e:
            log("Could not run relational database initialization scripts: " + getDBError(e))
        tryCount = tryCount + 1
        time.sleep(20)

def tryToResolveDatabaseHostName(address, waitAmountInSeconds):
    log("Attempting to resolve the relational database hostname '" + address + "' for " + str(waitAmountInSeconds) + " seconds...")
    for i in range(waitAmountInSeconds):
        try: 
            host_name = address
            host_ip = socket.gethostbyname(host_name) 
            log("Successfully resolved hostname: '" + address + "' to '" + host_ip + "'.")
            break
        except: 
            pass
        time.sleep(1)
    return

def initServiceScripts(serviceName, waitOnInit = True):
    try:
        runDatabaseInitScripts(scriptsDictionary = configs["appServices"][serviceName]["sqlScripts"], waitOnInit = waitOnInit)
    except Exception as e:
        log("Could not run relational database initialization scripts: " + getDBError(e))
    return

def runDatabaseInitScripts(scriptsDictionary = None, scriptNames = None, isCore = False, waitOnInit = True):
    if waitOnInit:
        waitOnInitialization()
    
    scriptsDir = "./sql"
    if isCore:
        scriptsDir = initScriptsDir

    if scriptsDictionary == None:
        scriptsDictionary = configs["appServices"]["relationaldb"]["sqlScripts"]
    sNames = []
    for name in scriptsDictionary:
        sNames.append(name)
    if scriptNames:
        sNames = scriptNames
    
    dbConnection = getDatabaseConnection(newConnection = True)
    for name in sNames:
        for result in executeBuildScript(dbConnection, databaseName, name, scriptsDir, isCore = isCore):
            log("Script result: " + libutil.toJSON(result, None))
    return

def executeBuildScript(dbConnection, databaseName, name, initScriptsDir, isCore = False):
    waitOnInitialization()

    tableName = getAppTableName(name, isCore)
    scriptName = getFullScriptPath(name, initScriptsDir)

    log("Attempting to run script " + scriptName + "...")
    script = []
    with open(scriptName, 'r') as f:
        script = f.readlines()

    for line in script:
        l = line.strip().rstrip()
        if len(l) > 0:
            variables = { 'databaseName': databaseName, 'tableName': tableName }
            for result in executeQuery(dbConnection, l, variables, manualReplace = True, logError = False):
                yield result
    log("Script '" + scriptName + "' is complete.")
    return None

def getFullScriptPath(name, dir = None):
    sDir = scriptsDir
    if not dir == None:
        sDir = dir
    return sDir + "/" + name + '.sql'

def getAppTableName(name, isCore = False):
    if isCore:
        return (libconf.getBranch() + "-core-" + name).replace("-", "_")
    else:
        return (libconf.getAppServiceNamePostfix() + "-" + name).replace("-", "_")

def getDatabaseConnection(autoCommit = True, newConnection = False):
        global dbC
        global databaseName

        waitOnInitialization()

        dbConnection = None
        if (dbC == None) or (newConnection== True):
            if dbC:
                closeDatabaseConnection(dbC)
            dbConnection = generateDatabaseConnection(autoCommit, databaseName)
            dbC = dbConnection
            return dbConnection
        else:
            return dbC
        dbC = dbConnection
        return dbConnection

def generateDatabaseConnection(autoCommit = True, dbName = None):
    waitOnInitialization()

    global databaseName
    global databaseAddress
    global databasePort
    global databaseUsername
    global databaseUserPassword
    dName = databaseName
    if dbName:
        dName = dbName
    log("Attempting relational database connection using DBName:" + dName + ", Address: " + databaseAddress + ", Port: " + databasePort + ", Username: " + databaseUsername + ", Password: " + databaseUserPassword + ", autoCommit: " + str(autoCommit))
    dbConnection = psycopg2.connect(database = dName, user = databaseUsername, password = databaseUserPassword, host = databaseAddress, port = databasePort)
    dbConnection.autocommit = autoCommit
    if autoCommit:
        dbConnection.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
    log("Connected to relational database.")
    return dbConnection

def closeDatabaseConnection(dbConnection):
    waitOnInitialization()
    
    log("Closing relational database connection...")
    if dbConnection:
        try:
            commitDatabaseConnection(dbConnection)
            dbConnection.close()
        except Exception as e:
            log("Error closing relational database connection: " + getDBError(e))
            dbConnection = None
            return
        dbConnection = None
    log("Relational database connection is closed.")

def commitDatabaseConnection(dbConnection):
    waitOnInitialization()

    log("Committing relational database connection...")
    try: 
        dbConnection.commit()
    except:
        log("Error committing relational database connection: " + getDBError(e))
        return
    log("Successfully committed relational database connection.")
    
def executeClientSideQuery(query, variables):
    waitOnInitialization()

    dbConnection = getDatabaseConnection(autoCommit=False)
    for result in executeQuery(dbConnection, query, variables):
        yield result
    return None
    
def executeServerSideQuery(query, variables):
    waitOnInitialization()

    dbConnection = getDatabaseConnection(autoCommit=False)
    for result in executeQuery(dbConnection, query, variables):
        yield result
    return None

def executeQuery(dbConnection, query, variables, serverSide = False, resultsPerFetch = 1, manualReplace = False, logError = True):
    waitOnInitialization()
    q = query
    if not useRDS:
        q = q + ";"
    cursorName = None
    if serverSide:
        cursorName = databaseName + "_Cursor"
    if manualReplace:
        for key in variables:
            q = q.replace("%(" + key + ")s", str(variables[key]))
    with dbConnection.cursor(name=cursorName, cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        sqlStatement = str(cur.mogrify(q, variables).decode("utf-8"))
        #log("Executing '" + sqlStatement + "'...")
        log("Executing '" + q + "'...")
        try:
            cur.arraysize = resultsPerFetch
            cur.execute(q, variables)
            queryResults = []
            results = buildDBResponse(cur, queryResults)
            if cur.description or serverSide:
                while results:
                    if serverSide:
                        results = cur.fetchmany()
                    else:
                        results = cur.fetchall()
                    if results:
                        yield buildDBResponse(cur, results)
            else:
                yield results
            log("Executed successfully with " + str(cur.rowcount) + " results.")
        except Exception as e:
            if logError:
                log("Failed execution of '" + sqlStatement + "': " + getDBError(e) + ".")
            yield buildDBErrorResponse(cur, e)
    return None

def getDBError(e):
    return str(e).rstrip() 

def buildDBResponse(cursor, queryResults = []):
    dbResponse = getDBResponseSkeleton()
    dbResponse["rowCount"] = cursor.rowcount
    dbResponse["rowNumber"] = cursor.rownumber
    dbResponse["results"] = queryResults
    dbResponse["statusmessage"] = cursor.statusmessage
    return dbResponse

def buildDBErrorResponse(cursor, e):
    dbResponse = getDBResponseSkeleton()
    dbResponse["isSuccess"] = False
    dbResponse["rowCount"] = cursor.rowcount
    dbResponse["rowNumber"] = cursor.rownumber
    dbResponse["statusmessage"] = cursor.statusmessage
    dbResponse["errormessage"] = getDBError(e)
    return dbResponse

def getDBResponseSkeleton():
    dbResponse = {
        "isSuccess": True,
        "rowCount": 0,
        "rowNumber": 0,
        "statusmessage": "", 
        "errormessage": "",
        "results": []
    }
    return dbResponse

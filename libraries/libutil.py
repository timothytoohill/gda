import sys

sys.dont_write_bytecode = True

import os
import binascii
import json
import threading
import uuid
import subprocess
import unicodedata
import re
import hashlib

uuidLock = threading.Lock()

def mergeLists(fromList, toList):
    for item in fromList:
        if not item in toList:
            toList.append(item)
    return

def mergeDictionaries(fromDict, toDict):
    for key in fromDict:
        if isinstance(fromDict[key], dict):
            if key in toDict:
                mergeDictionaries(fromDict[key], toDict[key])
                continue
            elif isinstance(fromDict[key], list):
                if key in toDict:
                    if isinstance(toDict[key], list):
                        mergeLists(fromDict[key], toDict[key])
                        continue
        toDict[key] = fromDict[key]
    return

def toJSON(dict, indent = 4):
    return json.dumps(dict, indent = indent, default = str)

def fromJSON(stringVal):
    return json.loads(stringVal)

def getThisInstanceID():
    global thisInstanceID
    return thisInstanceID

def getUUID4():
    global uuidLock
    id = None
    with uuidLock:
        id = str(uuid.uuid4())
    return id

def getUUID():
    return binascii.b2a_hex(os.urandom(4)).decode('utf-8')

def getHash(strVal):
    hashObject = hashlib.sha512(strVal.encode())
    return hashObject.hexdigest()        

def getHash256(strVal):
    hashObject = hashlib.sha256(strVal.encode())
    return hashObject.hexdigest()        

def shellReader(cmd, redirectStdErr = True):
    pObj = None
    if redirectStdErr:
        pObj = subprocess.Popen(cmd, shell = True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True)
    else:
        pObj = subprocess.Popen(cmd, shell = True, stdout=subprocess.PIPE, universal_newlines=True)
    for line in iter(pObj.stdout.readline, ""):
        yield removeControlCharacters(line).rstrip()
    pObj.stdout.close()
    return_code = pObj.wait()
    if return_code:
        raise subprocess.CalledProcessError(return_code, cmd)

def removeControlCharacters(s):
    #return "".join(ch for ch in s if unicodedata.category(ch)[0] != "C")
    ansi_escape = re.compile(r'\x1B[@-_][0-?]*[ -/]*[@-~]')
    result = ansi_escape.sub('', s)
    return result

def isThreadAlive(t):
    isAlive = False
    try:
        isAlive = t.isAlive()
    except Exception as e:
        isAlive = t.is_alive()
    return isAlive

thisInstanceID = getUUID()

import sys

sys.dont_write_bytecode = True

import threading
import time
import psutil

import libconf
import liblogging
import libinfrastructure
import libutil

log = liblogging.Logger('monitor').log
appConfigs = libinfrastructure.getAppConfigs()
monitorThread = None
process = psutil.Process()

def outputMonitorInfo():
    log(getActiveThreadCount(), "pythonThreadCount")
    log(getThreadNames(), "pythonThreads")
    log(getCPUUsage(), "systemCPUUsage")
    log(getAvgCPULoads(), "systemAvgCPULoads(5,10,15min)")
    log(getMemUsagePercent(), "systemMemUsage")
    log(getMemUsage(), "systemMemDetails")
    log(getDiskUsage(), "systemDiskUsage")
    log(getDiskUsageDetails(), "systemDiskDetails")
    log(getProcessCommandLine(), "processCmdLine")
    log(getProcessTCPConnectionCount(), "processTCPConnectionCount")
    log(getProcessCPUUsage(), "processCPUUsage")
    log(getProcessMemoryUsage(), "processMemUsage")
    return

def outputMonitorInfoSimple():
    log(getActiveThreadCount(), "pythonThreadCount")
    log(getThreadNames(), "pythonThreads")
    log(getProcessCPUUsage(), "processCPUUsage")
    log(getMemUsagePercent(), "systemMemUsage")
    return

def monitorThread():
    while True:
        #outputMonitorInfo()
        outputMonitorInfoSimple()
        time.sleep(300)
    return

def startMonitorThread():
    global monitorThread
    log("Starting monitor thread...")
    monitorThread = threading.Thread(target=monitorThread, args = [])
    monitorThread.daemon = True
    monitorThread.name = "MonitorThread"
    monitorThread.start()
    log("Monitor thread started.")
    return

def getThreadNames():
    threadList = threading.enumerate()
    names = ""
    if len(threadList) > 0:
        if len(threadList) > 1:
            sep = ""
            for thread in threadList:
                names = names + sep + thread.name
                sep = ", "
        else:
            names = threadList[0].name
    return names

def getActiveThreadCount():
    return str(threading.activeCount())

def getCPUUsage():
    return str(psutil.cpu_times_percent())

def getAvgCPULoads():
    result = [x / psutil.cpu_count() * 100 for x in psutil.getloadavg()]
    return str(result)

def getMemUsagePercent():
    return str(psutil.virtual_memory().percent)

def getMemUsage():
    return str(psutil.virtual_memory())

def getDiskUsage():
    return str(psutil.disk_usage('/').percent)

def getDiskUsageDetails():
    return str(psutil.disk_usage('/'))

def getProcessTCPConnectionCount():
    count = 0
    for connection in process.connections(kind='tcp'):
        if connection.status == psutil.CONN_ESTABLISHED:
            count += 1
    return str(count)

def getProcessCommandLine():
    return str(process.cmdline())

def getProcessCPUUsage():
    return str(process.cpu_percent())

def getProcessMemoryUsage():
    return str(process.memory_percent())
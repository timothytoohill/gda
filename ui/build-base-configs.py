import sys

sys.dont_write_bytecode = True
sys.path.append("../libraries")
sys.path.append("../infrastructure")

import liballinit
import liblogging
import libconf
import libinfrastructure
import libutil

log = liblogging.Logger('build-ui-base-configs').log

def buildBaseConfigs(serviceName, configs):
    log("Building base configs for service '" + serviceName + "'...")
    service = configs["appServices"][serviceName]
    dir = "." #service["directory"]
    serviceConfigs = libconf.loadConfigFile(dir + "/" + libconf.serviceConfigFile)
    libutil.mergeDictionaries(serviceConfigs, configs)
    libconf.saveServiceBaseConfigFile(dir, configs)
    log("Done building base configs for service '" + serviceName + "'.", waitForSend = True)

def run(serviceName):
    configs = libconf.getLoadedConfigsCopy()
    buildBaseConfigs(serviceName, configs)

serviceName = "ui"
if len(sys.argv) > 1:
    serviceName = sys.argv[1]

run(serviceName)
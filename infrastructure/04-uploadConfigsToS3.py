import sys

sys.dont_write_bytecode = True
sys.path.append("../libraries")

import liballinit
import libconf

def run():
    libconf.saveConfigsToS3()

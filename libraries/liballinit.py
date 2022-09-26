import sys

sys.dont_write_bytecode = True

import libconf

libconf.init()

import liblogging

liblogging.connectMQTTClientOnThread()

import libmonitor

libmonitor.startMonitorThread()

import libinfrastructure
import libfastapi

import libdb_relational

libdb_relational.initDatabase()
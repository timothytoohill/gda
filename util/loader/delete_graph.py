#!/usr/local/bin/python3

import sys

sys.dont_write_bytecode = True
sys.path.append("../../libraries")
sys.path.append("../../api")

import libconf

libconf.init()

import liblogging
import graphdb_connection

import libloader

log = liblogging.Logger('loader').log

serverAddress = libconf.getAddressForService("gremlinserver")

def run():
    log("Deleting graph...")
    schemaContext = graphdb_connection.getAppGraphSchemaContext(serverAddress)
    q("schema.drop();", schemaContext)
    graphdb_connection.closeGraphContext(schemaContext)
    log("Done deleting graph.")

def q(query, context):
    return graphdb_connection.query_by_string(query, context)

run()

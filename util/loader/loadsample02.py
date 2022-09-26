#!/usr/local/bin/python3

import sys

sys.dont_write_bytecode = True
sys.path.append("../../libraries")
sys.path.append("../../api")

import libconf
import liblogging
import graphdb_connection
import libloader

log = liblogging.Logger('loader').log

serverAddress = libconf.getAddressForService("gremlinserver")

graphdb_connection.createAppGraph(serverAddress)

def run():
    log("Creating contexts...")
    schemaContext = graphdb_connection.getAppGraphSchemaContext(serverAddress)
    context = graphdb_connection.getAppGraphContext(serverAddress)
    log("Done creating contexts.")

    csvFilePath = "demo_data/Demo Data- Task Management System - Projects.csv"
    partitionColumnName = "Project"
    propertyColumns = [{"name": "Project", "type": "Text"}, {"name": "Customer", "type": "Text"}]
    libloader.createVerticiesFromCSV(schemaContext, context, csvFilePath, "project", partitionColumnName, propertyColumns, indexProperties = ["Customer"])

    csvFilePath = "demo_data/Demo Data- Task Management System - Projects.csv"
    partitionColumnName = "Customer"
    propertyColumns = [{"name": "Customer", "type": "Text"}]
    libloader.createVerticiesFromCSV(schemaContext, context, csvFilePath, "customer", partitionColumnName, propertyColumns)

    csvFilePath = "demo_data/Demo Data-Employee Time Tracking System - Ops Employee.csv"
    partitionColumnName = "Employee Name"
    propertyColumns = [{"name": "Employee Name", "type": "Text"}, {"name": "Customer", "type": "Text"}, {"name": "Project", "type": "Text"}, {"name": "Hours", "type": "Float"}]
    libloader.createVerticiesFromCSV(schemaContext, context, csvFilePath, "employee", partitionColumnName, propertyColumns, indexProperties = ["Customer", "Project"])

    csvFilePath = "demo_data/Demo Data-CRM System - BD Expenses.csv"
    partitionColumnName = "Customer"
    propertyColumns = [{"name": "Customer", "type": "Text"}, {"name": "Amount", "type": "Decimal"}, {"name": "Date", "type": "Date"}]
    libloader.createVerticiesFromCSV(schemaContext, context, csvFilePath, "expense", partitionColumnName, propertyColumns)

    csvFilePath = "demo_data/Demo Data-Business Ops_Invoice Tracking System  - Invoices.csv"
    partitionColumnName = "Customer"
    propertyColumns = [{"name": "Invoice Number", "type": "Int"}, {"name": "Customer", "type": "Text"}, {"name": "Amount", "type": "Decimal"}, {"name": "Date", "type": "Date"}]
    libloader.createVerticiesFromCSV(schemaContext, context, csvFilePath, "invoice", partitionColumnName, propertyColumns)

    libloader.createBiDirectionalEdges(schemaContext, context, "belongsTo", "project", "customer", "Customer", "Customer")
    libloader.createBiDirectionalEdges(schemaContext, context, "services", "employee", "customer", "Customer", "Customer")
    libloader.createBiDirectionalEdges(schemaContext, context, "worksOn", "employee", "project", "Project", "Project")
    libloader.createBiDirectionalEdges(schemaContext, context, "chargedTo", "expense", "customer", "Customer", "Customer")
    libloader.createBiDirectionalEdges(schemaContext, context, "bills", "invoice", "customer", "Customer", "Customer")

    #if the movie sample is loaded, create one bi-directional edge bewtween the datasets
    query = "schema.vertexLabel('movie').describe();"
    result = libloader.q(query, schemaContext)
    if result.one():
        g = context["g"]
        libloader.createBiDirectionalEdgeSchema(schemaContext, "auditioned", "employee", "movie")
        employee = g.V().has("employee", "employee_name", "Gilfoyle")
        movie = g.V().has("movie", "title", "The Happening")
        g.addE("auditioned").from_(employee).to(movie).next()
        g.addE("auditioned").from_(movie).to(employee).next()
    log("Closing contexts...")
    graphdb_connection.closeGraphContext(schemaContext)
    graphdb_connection.closeGraphContext(context)
    log("Done closing contexts.")
    return

log("Loading sample data...")
run()
log("Done loading sample data.")
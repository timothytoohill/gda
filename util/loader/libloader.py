#!/usr/local/bin/python3

import sys

sys.dont_write_bytecode = True
sys.path.append("../../libraries")

import csv
import datetime
import re
from decimal import Decimal

import libconf
import graphdb_connection

libconf.init()

import liblogging

log = liblogging.Logger('loader').log

def q(query, context):
    return graphdb_connection.query_by_string(query, context)

def getValidGraphPropertyName(name):
    return name.strip().replace(" ", "_").lower()

def getValidGraphPropertyValue(strValue, type):
    if type == "Text":
        return strValue
    elif type == "Int":
        return int(re.sub(r'[^0-9.]', '', strValue))
    elif type == "Date":
        d = strValue.strip().split("-")
        return datetime.date(int(d[0]), int(d[1]), int(d[2]))
    elif type == "Decimal":
        return Decimal(re.sub(r'[^0-9.]', '', strValue))
    elif type == "Float":
        return float(re.sub(r'[^0-9.]', '', strValue))
    else:
        log("Could not convert '" + strValue + "' for type: " + type + ". Returning as string and hoping for the best.")
    return strValue

def createVertexSchemaFromCSV(schemaContext, label, partitionColumnName, propertyColumns = [], indexProperties = []):
    pcol = getValidGraphPropertyName(partitionColumnName)
    for column in propertyColumns:
        if column["name"] == partitionColumnName:
            partitionColumnType = column["type"]
            break
    query = f"schema.vertexLabel('{label}').ifNotExists().partitionBy('{pcol}', {partitionColumnType})"
    for column in propertyColumns:
        if (column["name"] == partitionColumnName):
            pass
        else:
            query += f".property('{getValidGraphPropertyName(column['name'])}', {column['type']})"
    query += ".create();"
    for indexProperty in indexProperties:
        iprop = getValidGraphPropertyName(indexProperty)
        query += f"schema.vertexLabel('{label}').materializedView('{label}_by_{iprop}').ifNotExists().partitionBy('{iprop}').clusterBy('{pcol}', Asc).create();" 
    log("Running: " + query)
    q(query, schemaContext)

def createVerticiesFromCSV(schemaContext, context, csvFilePath, label, partitionColumnName, propertyColumns = [], indexProperties = []):
    createVertexSchemaFromCSV(schemaContext, label, partitionColumnName, propertyColumns, indexProperties)
    dedupeHashList = []
    g = context["g"]
    with open(csvFilePath) as csv_file:
        csv_reader = csv.reader(csv_file, delimiter=',')
        line_count = 0
        columnIndexByName = {}
        for row in csv_reader:
            if line_count == 0:
                for i in range(len(row)):
                    columnIndexByName[row[i].strip()] = i
            else:
                rowHash = hash(str(row))
                if rowHash in dedupeHashList:
                    continue
                else:
                    dedupeHashList.append(rowHash)
                iterator = g.addV(label)
                for column in propertyColumns:
                    columnName = column["name"].strip()
                    graphColumnName = getValidGraphPropertyName(columnName)
                    iterator = iterator.property(graphColumnName, getValidGraphPropertyValue(row[columnIndexByName[columnName]], column["type"]))
                v = iterator.next()
            line_count += 1
    return

def createEdgeSchema(schemaContext, label, vertexLabel1, vertexLabel2, indexProperties = []):
    query = f"schema.edgeLabel('{label}').ifNotExists().from('{vertexLabel1}').to('{vertexLabel2}').create();"
    log("Running: " + query)
    q(query, schemaContext)
    return

def createBiDirectionalEdgeSchema(schemaContext, label, vertexLabel1, vertexLabel2, indexProperties = []):
    createEdgeSchema(schemaContext, label, vertexLabel1, vertexLabel2, indexProperties)
    createEdgeSchema(schemaContext, label, vertexLabel2, vertexLabel1, indexProperties)
    return

def createEdges(schemaContext, context, label, vertexLabel1, vertexLabel2, vertexLookupProperty1, vertexLookupProperty2, indexProperties = []):
    createEdgeSchema(schemaContext, label, vertexLabel1, vertexLabel2, indexProperties)
    g = context["g"]
    prop1 = getValidGraphPropertyName(vertexLookupProperty1)
    prop2 = getValidGraphPropertyName(vertexLookupProperty2)
    for v1 in g.V().hasLabel(vertexLabel1):
        v1Props = g.V(v1).valueMap(True).next()
        for v2 in g.V().has(vertexLabel2, prop2, v1Props[prop2][0]):
            g.addE(label).from_(v1).to(v2).next()
    return

def createBiDirectionalEdges(schemaContext, context, label, vertexLabel1, vertexLabel2, vertexLookupProperty1, vertexLookupProperty2, indexProperties = []):
    createEdges(schemaContext, context, label, vertexLabel1, vertexLabel2, vertexLookupProperty1, vertexLookupProperty2, indexProperties)
    createEdges(schemaContext, context, label, vertexLabel2, vertexLabel1, vertexLookupProperty1, vertexLookupProperty2, indexProperties)
    return

def printCSVFile(csvFilePath):
    with open(csvFilePath) as csvFile:
        csv_reader = csv.reader(csvFile, delimiter=',')
        for row in csv_reader:
            print(row)
    return

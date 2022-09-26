import sys

sys.dont_write_bytecode = True

import liballinit
import libconf
import libutil
import liblogging
import libdb_relational

log = liblogging.Logger('core-services').log
configs = libconf.getLoadedConfigs()

listsTableName = libdb_relational.getAppTableName("lists", isCore = True)
listsDataTableName = libdb_relational.getAppTableName("lists_data", isCore = True)
listsSubscribersTableName = libdb_relational.getAppTableName("lists_subscribers", isCore = True)

def create(listName):
    log("Creating list '" + listName + "'...")
    variables = {
        "listName": listName
    }
    query = "SELECT * FROM {tableName} WHERE name = %(listName)s".format(tableName=listsTableName)
    for response in libdb_relational.executeClientSideQuery(query, variables):
        if response["rowCount"] > 0:
            log("List already exists.")
            return
    query = "INSERT INTO {tableName} (name) VALUES (%(listName)s)".format(tableName=listsTableName)
    for response in libdb_relational.executeClientSideQuery(query, variables):
        pass
    log("List '" + listName + "' created successfully.")
    return

def delete(listName):
    log("Deleting list '" + listName + "'...")
    variables = {
        "listName": listName
    }
    listFound = False
    query = "SELECT * FROM {tableName} WHERE name = %(listName)s".format(tableName=listsTableName)
    for response in libdb_relational.executeClientSideQuery(query, variables):
        if response["rowCount"] > 0:
            listFound = True
            break
    if listFound:
        deleteListSubscribers(listName)
        deleteData(listName)
        query = "DELETE FROM {tableName} WHERE name = %(listName)s".format(tableName=listsTableName)
        for response in libdb_relational.executeClientSideQuery(query, variables):
            pass
        log("List '" + listName + "' deleted successfully.")
    else:
        log("List does not exist.")
    return

def deleteData(listName):
    log("Deleting data for list '" + listName + "'...")
    variables = {
        "listName": listName
    }
    query = "DELETE FROM {tableName} WHERE list_name = %(listName)s".format(tableName=listsDataTableName)
    for response in libdb_relational.executeClientSideQuery(query, variables):
        pass
    log("Data for list '" + listName + "' deleted successfully.")
    
def addItem(listName, key, value):
    log("Adding list item '" + key + "' to list '" + listName + "'...")
    variables = {
        "listName": listName,
        "key": key,
        "value": value
    }
    query = "INSERT INTO {tableName} (list_name, key, value) VALUES (%(listName)s, %(key)s, %(value)s)".format(tableName=listsDataTableName)
    for response in libdb_relational.executeClientSideQuery(query, variables):
        pass
    log("Successfully added list item.")
    return

def getItems(listName, count, lastSeqNum):
    log("Getting " + str(count) + " items from list '" + listName + "' with seq_num > " + str(lastSeqNum) + "...")
    variables = {
        "listName": listName,
        "count": count,
        "lastSeqNum": lastSeqNum
    }
    query = "SELECT * FROM {tableName} WHERE list_name = %(listName)s AND seq_num > %(lastSeqNum)s ORDER BY seq_num ASC LIMIT %(count)s".format(tableName=listsDataTableName)
    for response in libdb_relational.executeClientSideQuery(query, variables):
        if response["rowCount"] > 0:
            for result in response["results"]:
                yield result

def getListCount(listName):
    log("Getting count for list '" + listName + "'...")
    variables = {
        "listName": listName
    }
    query = "SELECT COUNT(*) AS count  FROM {tableName} WHERE list_name = %(listName)s".format(tableName=listsDataTableName)
    for response in libdb_relational.executeClientSideQuery(query, variables):
        if response["rowCount"] > 0:
            for result in response["results"]:
                yield result


def createSubscriber(subscriberName, listName):
    log("Creating subscriber '" + subscriberName + "' for list '" + listName + "'...")
    variables = {
        "name": subscriberName,
        "listName": listName
    }
    query = "INSERT INTO {tableName} (name, list_name) VALUES (%(name)s, %(listName)s)".format(tableName=listsSubscribersTableName)
    for response in libdb_relational.executeClientSideQuery(query, variables):
        pass
    log("Successfully created subscriber.")
    return

def deleteSubscriber(subscriberName, listName):
    log("Deleting subscriber '" + subscriberName + "' for list '" + listName + "'...")
    variables = {
        "name": subscriberName,
        "listName": listName
    }
    query = "DELETE FROM {tableName} WHERE name = %(name)s AND list_name = %(listName)s".format(tableName=listsSubscribersTableName)
    for response in libdb_relational.executeClientSideQuery(query, variables):
        pass
    log("Successfully deleted subscriber.")
    return

def deleteListSubscribers(listName):
    log("Deleting subscribers for list '" + listName + "'...")
    variables = {
        "listName": listName
    }
    query = "DELETE FROM {tableName} WHERE list_name = %(listName)s".format(tableName=listsSubscribersTableName)
    for response in libdb_relational.executeClientSideQuery(query, variables):
        pass
    log("Successfully deleted subscribers.")
    return

def getSubscriberSeqNum(subscriberName, listName):
    log("Getting subscriber '" + subscriberName + "' current seq_num for list '" + listName + "'...")
    variables = {
        "name": subscriberName,
        "listName": listName
    }
    query = "SELECT list_seq_num FROM {tableName} WHERE name = %(name)s AND list_name = %(listName)s".format(tableName=listsSubscribersTableName)
    for response in libdb_relational.executeClientSideQuery(query, variables):
        if response["rowCount"] > 0:
            for result in response["results"]:
                return result["list_seq_num"]

def updateSubscriberSeqNum(subscriberName, listName, seqNum):
    log("Updating seq_num of subscriber '" + subscriberName + "' for list '" + listName + "'...")
    variables = {
        "name": subscriberName,
        "listName": listName,
        "seqNum": seqNum
    }
    query = "UPDATE {tableName} SET list_seq_num = %(seqNum)s WHERE name = %(name)s AND list_name = %(listName)s".format(tableName=listsSubscribersTableName)
    for response in libdb_relational.executeClientSideQuery(query, variables):
        pass
    log("Successfully updated subscriber.")
    return

def getSubscriberItems(subscriberName, listName, count):
    log("Getting " + str(count) + " items for subscriber '" + subscriberName + "' for list '" + listName + "'...")
    lastSeqNum = getSubscriberSeqNum(subscriberName, listName)
    for item in getItems(listName, count, lastSeqNum):
        lastSeqNum = item["seq_num"]
        yield item
    updateSubscriberSeqNum(subscriberName, listName, lastSeqNum)
        

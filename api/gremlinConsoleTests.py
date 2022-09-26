#!/usr/local/bin/python3

import sys

sys.dont_write_bytecode = True

import os
import json
import pathlib
import boto3
import threading
import uuid
import csv
import io
import time
import traceback
import paho.mqtt.client as mqtt
import hashlib

from gremlin_python import statics
from gremlin_python.structure.graph import Graph
from gremlin_python.process.graph_traversal import __
from gremlin_python.process.strategies import *
from gremlin_python.driver.driver_remote_connection import DriverRemoteConnection
from gremlin_python.process.traversal import T, P, Operator
#from gremlin_python.driver.aiohttp.transport import AiohttpTransport

from cassandra.cluster import Cluster, GraphExecutionProfile, EXEC_PROFILE_GRAPH_DEFAULT, EXEC_PROFILE_GRAPH_SYSTEM_DEFAULT
from cassandra.graph import GraphOptions, GraphProtocol, graph_graphson3_row_factory

graphDBURL = "ws://InvictusDevWorkstation.invictus:8182/gremlin"

mainSession = None

"""
graph = Graph()
remoteConn = DriverRemoteConnection(graphDBURL,'g')
g = graph.traversal().withRemote(remoteConn)
"""
def createGraph():
    cluster = Cluster(["InvictusDevWorkstation.invictus"])
    session = cluster.connect()

    try:
        graph_name = 'movies'
        session.execute_graph("system.graph(name).create()", {'name': graph_name},
                            execution_profile=EXEC_PROFILE_GRAPH_SYSTEM_DEFAULT)
    except Exception as e:
        print(str(e))

def getSession():
    graph_name = 'movies'
    ep_graphson3 = GraphExecutionProfile(
        row_factory=graph_graphson3_row_factory,
        graph_options=GraphOptions(
            graph_protocol=GraphProtocol.GRAPHSON_3_0,
            graph_name=graph_name))

    cluster = Cluster(["InvictusDevWorkstation.invictus"], execution_profiles={'core': ep_graphson3})
    session = cluster.connect()
    return session

def buildSchema(session):
    # A Vertex represents a "thing" in the world.
    # Create the genre vertex
    try:
        query = """
            schema.vertexLabel('genre')
                .partitionBy('genreId', Int)
                .property('name', Text)
                .create()
        """
        session.execute_graph(query, execution_profile='core')
    except Exception as e:
        print(str(e))
        
    # Create the person vertex
    query = """
        schema.vertexLabel('person')
            .partitionBy('personId', Int)
            .property('name', Text)
            .create()
    """
    session.execute_graph(query, execution_profile='core')

    # Create the movie vertex
    query = """
        schema.vertexLabel('movie')
            .partitionBy('movieId', Int)
            .property('title', Text)
            .property('year', Int)
            .property('country', Text)
            .create()
    """
    session.execute_graph(query, execution_profile='core')

    # An edge represents a relationship between two vertices
    # Create our edges
    queries = """
    schema.edgeLabel('belongsTo').from('movie').to('genre').create();
    schema.edgeLabel('actor').from('movie').to('person').create();
    """
    session.execute_graph(queries, execution_profile='core')

    # Indexes to execute graph requests efficiently

    # If you have a node with the search workload enabled (solr), use the following:
    indexes = """
        schema.vertexLabel('genre').searchIndex()
            .by("name")
            .create();

        schema.vertexLabel('person').searchIndex()
            .by("name")
            .create();

        schema.vertexLabel('movie').searchIndex()
            .by('title')
            .by("year")
            .create();
    """
    session.execute_graph(indexes, execution_profile='core')

    # Otherwise, use secondary indexes:
    indexes = """
        schema.vertexLabel('genre')
            .secondaryIndex('by_genre')
            .by('name')
            .create()

        schema.vertexLabel('person')
            .secondaryIndex('by_name')
            .by('name')
            .create()

        schema.vertexLabel('movie')
            .secondaryIndex('by_title')
            .by('title')
            .create()
    """
    session.execute_graph(indexes, execution_profile='core') 
    indexes = """
        schema.edgeLabel('belongsTo')
            .from('movie')
            .to('genre')
            .materializedView('movie__belongsTo__genre_by_in_genreId')
            .ifNotExists()
            .partitionBy(IN, 'genreId')
            .clusterBy(OUT, 'movieId', Asc)
            .create()

        schema.edgeLabel('actor')
            .from('movie')
            .to('person')
            .materializedView('movie__actor__person_by_in_personId')
            .ifNotExists()
            .partitionBy(IN, 'personId')
            .clusterBy(OUT, 'movieId', Asc)
            .create()
    """
    session.execute_graph(indexes, execution_profile='core')

def addDataV(session):
    session.execute_graph("""
        g.addV('genre').property('genreId', 1).property('name', 'Action').next();
        g.addV('genre').property('genreId', 2).property('name', 'Drama').next();
        g.addV('genre').property('genreId', 3).property('name', 'Comedy').next();
        g.addV('genre').property('genreId', 4).property('name', 'Horror').next();
    """, execution_profile='core')

    session.execute_graph("""
        g.addV('person').property('personId', 1).property('name', 'Mark Wahlberg').next();
        g.addV('person').property('personId', 2).property('name', 'Leonardo DiCaprio').next();
        g.addV('person').property('personId', 3).property('name', 'Iggy Pop').next();
    """, execution_profile='core')

    session.execute_graph("""
        g.addV('movie').property('movieId', 1).property('title', 'The Happening').
            property('year', 2008).property('country', 'United States').next();
        g.addV('movie').property('movieId', 2).property('title', 'The Italian Job').
            property('year', 2003).property('country', 'United States').next();

        g.addV('movie').property('movieId', 3).property('title', 'Revolutionary Road').
            property('year', 2008).property('country', 'United States').next();
        g.addV('movie').property('movieId', 4).property('title', 'The Man in the Iron Mask').
            property('year', 1998).property('country', 'United States').next();

        g.addV('movie').property('movieId', 5).property('title', 'Dead Man').
            property('year', 1995).property('country', 'United States').next();
    """, execution_profile='core')

def addDataE(session):
    session.execute_graph("""
        genre_horror = g.V().hasLabel('genre').has('name', 'Horror').id().next();
        genre_drama = g.V().hasLabel('genre').has('name', 'Drama').id().next();
        genre_action = g.V().hasLabel('genre').has('name', 'Action').id().next();

        leo  = g.V().hasLabel('person').has('name', 'Leonardo DiCaprio').id().next();
        mark = g.V().hasLabel('person').has('name', 'Mark Wahlberg').id().next();
        iggy = g.V().hasLabel('person').has('name', 'Iggy Pop').id().next();

        the_happening = g.V().hasLabel('movie').has('title', 'The Happening').id().next();
        the_italian_job = g.V().hasLabel('movie').has('title', 'The Italian Job').id().next();
        rev_road = g.V().hasLabel('movie').has('title', 'Revolutionary Road').id().next();
        man_mask = g.V().hasLabel('movie').has('title', 'The Man in the Iron Mask').id().next();
        dead_man = g.V().hasLabel('movie').has('title', 'Dead Man').id().next();

        g.addE('belongsTo').from(__.V(the_happening)).to(__.V(genre_horror)).next();
        g.addE('belongsTo').from(__.V(the_italian_job)).to(__.V(genre_action)).next();
        g.addE('belongsTo').from(__.V(rev_road)).to(__.V(genre_drama)).next();
        g.addE('belongsTo').from(__.V(man_mask)).to(__.V(genre_drama)).next();
        g.addE('belongsTo').from(__.V(man_mask)).to(__.V(genre_action)).next();
        g.addE('belongsTo').from(__.V(dead_man)).to(__.V(genre_drama)).next();

        g.addE('actor').from(__.V(the_happening)).to(__.V(mark)).next();
        g.addE('actor').from(__.V(the_italian_job)).to(__.V(mark)).next();
        g.addE('actor').from(__.V(rev_road)).to(__.V(leo)).next();
        g.addE('actor').from(__.V(man_mask)).to(__.V(leo)).next();
        g.addE('actor').from(__.V(dead_man)).to(__.V(iggy)).next();
    """, execution_profile='core')

def queryG(session):
    # Find all movies of the genre Drama
    for r in session.execute_graph("""
    g.V().has('genre', 'name', 'Drama').in('belongsTo').valueMap();""", execution_profile='core'):
        print(r)

    # Find all movies of the same genre than the movie 'Dead Man'
    for r in session.execute_graph("""
    g.V().has('movie', 'title', 'Dead Man').out('belongsTo').in('belongsTo').valueMap();""", execution_profile='core'):
        print(r)

    # Find all movies of Mark Wahlberg
    for r in session.execute_graph("""
    g.V().has('person', 'name', 'Mark Wahlberg').in('actor').valueMap();""", execution_profile='core'):
        print(r)

def query(q):
    return mainSession.execute_graph(q, execution_profile='core')

def run():
    global mainSession
    #createGraph()
    session = getSession()
    mainSession = session
    #buildSchema(session)
    #addDataV(session)
    addDataE(session)
    queryG(session)
    print(query("g.V().id().next()"))
    for x in query("g.E().id()"):
        print(x)

"""
def run():
    print(g.addV('student').property('name', 'Jeffery').property('GPA', 4.0).valueMap(True).next())

    query = g.V()
    a = query.next()
    b = query.next()
    print(str(a))
    print(str(b))
    print(g.V(a).next())
    print(g.V(b).next())
    
    g.V(a).addE("test").to(__.V(b)).iterate()

    print("")

    print(g.V(8344).bothE().valueMap(True).next())

    #g.V().explain()

    #print(g.V().inV().next())

    #print(g.E().valueMap(True).next())

    #print(g.E().toList()) #valueMap(True).next())

    #print(g.E().inV().next())

    remoteConn.close()
"""
run()

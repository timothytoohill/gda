#!/usr/local/bin/python3

import sys

sys.dont_write_bytecode = True
sys.path.append("../../libraries")
sys.path.append("../../api")

import time

import libconf

libconf.init()

import liblogging
import graphdb_connection

log = liblogging.Logger('loader').log

serverAddress = libconf.getAddressForService("gremlinserver")

log("Creating app graph if it does not exist...")
graphdb_connection.createAppGraph(serverAddress)
log("Done creating app graph if it does not exist.")

def run():
    log("Creating contexts...")
    schemaContext = graphdb_connection.getAppGraphSchemaContext(serverAddress)
    context = graphdb_connection.getAppGraphContext(serverAddress)
    log("Done creating contexts.")
    log("Building schema...")
    buildSchema(schemaContext)
    log("Done building schema.")
    log("Adding entities...")
    addEntities(context)
    log("Done adding entities.")
    log("Adding relationships...")
    addRelationships(context)
    log("Done adding relationships.")
    log("Closing contexts...")
    graphdb_connection.closeGraphContext(schemaContext)
    graphdb_connection.closeGraphContext(context)
    log("Done closing contexts.")

def q(query, context):
    return graphdb_connection.query_by_string(query, context)

def buildSchema(context):
    query = "schema.vertexLabel('genre').partitionBy('genreId', Int).property('name', Text).create();"
    q(query, context)
    query = "schema.vertexLabel('person').partitionBy('personId', Int).property('name', Text).create();"
    q(query, context)
    query = "schema.vertexLabel('movie').partitionBy('movieId', Int).property('title', Text).property('year', Int).property('country', Text).create();"
    q(query, context)
    query = "schema.edgeLabel('belongsTo').from('movie').to('genre').create();"
    query += "schema.edgeLabel('belongsTo').from('genre').to('movie').create();"
    query += "schema.edgeLabel('actor').from('movie').to('person').create();"
    query += "schema.edgeLabel('actor').from('person').to('movie').create();"
    q(query, context)
    indexes = "schema.vertexLabel('genre').searchIndex().by('name').create();"
    indexes += "schema.vertexLabel('person').searchIndex().by('name').create();"
    indexes += "schema.vertexLabel('movie').searchIndex().by('title').by('year').create();"
    q(indexes, context)
    indexes = "schema.vertexLabel('genre').secondaryIndex('by_genre').by('name').create();"
    indexes += "schema.vertexLabel('person').secondaryIndex('by_name').by('name').create();"
    indexes += "schema.vertexLabel('movie').secondaryIndex('by_title').by('title').create();"
    q(indexes, context)
    indexes = "schema.edgeLabel('belongsTo').from('movie').to('genre').materializedView('movie__belongsTo__genre_by_in_genreId').ifNotExists().partitionBy(IN, 'genreId').clusterBy(OUT, 'movieId', Asc).create();"
    indexes += "schema.edgeLabel('belongsTo').from('genre').to('movie').materializedView('genre__belongsTo__movie_by_in_movieId').ifNotExists().partitionBy(IN, 'movieId').clusterBy(OUT, 'genreId', Asc).create();"
    indexes += "schema.edgeLabel('actor').from('movie').to('person').materializedView('movie__actor__person_by_in_personId').ifNotExists().partitionBy(IN, 'personId').clusterBy(OUT, 'movieId', Asc).create();"
    indexes += "schema.edgeLabel('actor').from('person').to('movie').materializedView('person__actor__movie_by_in_movieId').ifNotExists().partitionBy(IN, 'movieId').clusterBy(OUT, 'personId', Asc).create();"
    q(indexes, context)
    return

def addEntities(context):
    g = context["g"]
    g.addV('genre').property('genreId', 1).property('name', 'Action').next()
    g.addV('genre').property('genreId', 2).property('name', 'Drama').next()
    g.addV('genre').property('genreId', 3).property('name', 'Comedy').next()
    g.addV('genre').property('genreId', 4).property('name', 'Horror').next()
    g.addV('person').property('personId', 1).property('name', 'Mark Wahlberg').next()
    g.addV('person').property('personId', 2).property('name', 'Leonardo DiCaprio').next()
    g.addV('person').property('personId', 3).property('name', 'Iggy Pop').next()
    g.addV('movie').property('movieId', 1).property('title', 'The Happening').property('year', 2008).property('country', 'United States').next()
    g.addV('movie').property('movieId', 2).property('title', 'The Italian Job').property('year', 2003).property('country', 'United States').next()
    g.addV('movie').property('movieId', 3).property('title', 'Revolutionary Road').property('year', 2008).property('country', 'United States').next()
    g.addV('movie').property('movieId', 4).property('title', 'The Man in the Iron Mask').property('year', 1998).property('country', 'United States').next()
    g.addV('movie').property('movieId', 5).property('title', 'Dead Man').property('year', 1995).property('country', 'United States').next()

def addRelationships(context):
    g = context["g"]
    waitingForConsistency = True
    while waitingForConsistency:
        try:
            genre_horror = g.V().hasLabel('genre').has('name', 'Horror').id().next()
            genre_drama = g.V().hasLabel('genre').has('name', 'Drama').id().next()
            genre_action = g.V().hasLabel('genre').has('name', 'Action').id().next()
            leo  = g.V().hasLabel('person').has('name', 'Leonardo DiCaprio').id().next()
            mark = g.V().hasLabel('person').has('name', 'Mark Wahlberg').id().next()
            iggy = g.V().hasLabel('person').has('name', 'Iggy Pop').id().next()
            the_happening = g.V().hasLabel('movie').has('title', 'The Happening').id().next()
            the_italian_job = g.V().hasLabel('movie').has('title', 'The Italian Job').id().next()
            rev_road = g.V().hasLabel('movie').has('title', 'Revolutionary Road').id().next()
            man_mask = g.V().hasLabel('movie').has('title', 'The Man in the Iron Mask').id().next()
            dead_man = g.V().hasLabel('movie').has('title', 'Dead Man').id().next()
            waitingForConsistency = False
        except Exception as e:
            log("Waiting for graph to become consistent: " + str(e) + "...")
            time.sleep(1)
    g.addE('belongsTo').from_(g.V(the_happening)).to(g.V(genre_horror)).next()
    g.addE('belongsTo').from_(g.V(genre_horror)).to(g.V(the_happening)).next()
    g.addE('belongsTo').from_(g.V(the_italian_job)).to(g.V(genre_action)).next()
    g.addE('belongsTo').from_(g.V(genre_action)).to(g.V(the_italian_job)).next()
    g.addE('belongsTo').from_(g.V(rev_road)).to(g.V(genre_drama)).next()
    g.addE('belongsTo').from_(g.V(genre_drama)).to(g.V(rev_road)).next()
    g.addE('belongsTo').from_(g.V(man_mask)).to(g.V(genre_drama)).next()
    g.addE('belongsTo').from_(g.V(genre_drama)).to(g.V(man_mask)).next()
    g.addE('belongsTo').from_(g.V(man_mask)).to(g.V(genre_action)).next()
    g.addE('belongsTo').from_(g.V(genre_action)).to(g.V(man_mask)).next()
    g.addE('belongsTo').from_(g.V(dead_man)).to(g.V(genre_drama)).next()
    g.addE('belongsTo').from_(g.V(genre_drama)).to(g.V(dead_man)).next()
    g.addE('actor').from_(g.V(the_happening)).to(g.V(mark)).next()
    g.addE('actor').from_(g.V(mark)).to(g.V(the_happening)).next()
    g.addE('actor').from_(g.V(the_italian_job)).to(g.V(mark)).next()
    g.addE('actor').from_(g.V(mark)).to(g.V(the_italian_job)).next()
    g.addE('actor').from_(g.V(rev_road)).to(g.V(leo)).next()
    g.addE('actor').from_(g.V(leo)).to(g.V(rev_road)).next()
    g.addE('actor').from_(g.V(man_mask)).to(g.V(leo)).next()
    g.addE('actor').from_(g.V(leo)).to(g.V(man_mask)).next()
    g.addE('actor').from_(g.V(dead_man)).to(g.V(iggy)).next()
    g.addE('actor').from_(g.V(iggy)).to(g.V(dead_man)).next()
    return

def test(context):
    g = context["g"]
    for r in g.V().has('movie', 'title', 'Dead Man').out('belongsTo').in_('belongsTo').valueMap():
        print(r)
    for r in g.V().has('person', 'name', 'Mark Wahlberg').in_('actor').valueMap():
        print(r)
    for r in g.V().has('genre', 'name', 'Drama').in_('belongsTo').valueMap():
        print(r)

log("Loading sample data...")
run()
log("Done loading sample data.")
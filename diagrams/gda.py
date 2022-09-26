#!/usr/local/bin/python3

from diagrams import Cluster, Diagram
from diagrams.aws.compute import EC2
from diagrams.aws.database import RDS
from diagrams.aws.network import ELB
from diagrams.generic.os import Windows 
from diagrams.generic.network import Firewall
from diagrams.onprem.client import Client
from diagrams.onprem.compute import Server

with Diagram("Architecture", show=False):
    with Cluster("Clients"):
        clients = [
            Client("Browser01"),
            Client("Browser02"),
            Client("Browser03"),
            Client("BrowserNN")
        ]
    with Cluster("GDA"):
        servers = [
            Server("UI"),
            Server("Graph DB"),
            Server("Message Queue")
        ]

    with Cluster(""):
        load_balancers = Server("GDA Load Balancers")

    servers >> load_balancers << clients


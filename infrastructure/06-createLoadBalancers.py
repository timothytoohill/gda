import sys

sys.dont_write_bytecode = True
sys.path.append("../libraries")

import boto3

import liballinit
import libconf
import liblogging

log = liblogging.Logger('create-load-balancers').log
configs = libconf.getLoadedConfigs()

def createLoadBalancer(name, port, availabilityZones, subnets, securityGroups, tags, vpcID, healthCheckPath, scheme):
    log("Creating '" + name + "' load balancer...")
    elbClient = boto3.client("elbv2")
    try:
        response = elbClient.describe_load_balancers(Names = [name])
        if len(response["LoadBalancers"]) > 0:
            log("Load balancer '" + name + "' exists.")
            return
    except Exception as e:
        pass
    log("Creating target group for '" + name + "' load balancer...")
    targetResponse = elbClient.create_target_group(Name = name, Protocol = "TCP", Port = port, VpcId = vpcID, HealthCheckProtocol = "HTTP", HealthCheckPath = healthCheckPath, TargetType = "ip")
    if len(targetResponse["TargetGroups"]) > 0:
        log("Created target group for '" + name + "' load balancer.")
    else:
        raise Exception("Failed to create target group for load balancer '" + name + "'.")
    log("Creating the load balancer '" + name + "'...")
    lbResponse = elbClient.create_load_balancer(Name = name, Type="network", Subnets=subnets, Scheme=scheme, Tags = tags)
    if len(lbResponse["LoadBalancers"]) > 0:
        log("Created the load balancer '" + name + "'.")
    else:
        raise Exception("Failed to create the load balancer '" + name + "'.")
    defaultActions = [
        {
            "Type": "forward",
            "TargetGroupArn": targetResponse["TargetGroups"][0]["TargetGroupArn"]
        }
    ]
    listenerResponse = elbClient.create_listener(LoadBalancerArn = lbResponse["LoadBalancers"][0]["LoadBalancerArn"], Protocol = "TCP", Port = port, DefaultActions = defaultActions)
    if len(listenerResponse["Listeners"]) > 0:
        log("Created listener for '" + name + "' load balancer.")
    else:
        raise Exception("Could not create listener for '" + name + "' load balancer.")
    log("Done creating '" + name + "' load balancer.")

def createLoadBalancerForService(serviceName):
    appService = configs["appServices"][serviceName]
    createLoadBalancer(libconf.generateCompleteAppServiceName(serviceName, configs), appService["port"], configs["aws"]["availabilityZones"], configs["aws"]["subnets"], configs["aws"]["securityGroups"], tags = configs["aws"]["tags"], vpcID = configs["aws"]["vpcID"], healthCheckPath = appService["healthCheckPath"], scheme = configs["aws"]["loadBalancerScheme"])

def run(serviceName = None):
    if serviceName == None:
        for serviceName in configs["appServices"]:
            createLoadBalancerForService(serviceName)
    else:
        createLoadBalancerForService(serviceName)

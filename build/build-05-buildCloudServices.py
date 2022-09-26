#!/usr/local/bin/python3

import sys

sys.dont_write_bytecode = True
sys.path.append("../libraries")
sys.path.append("../infrastructure")

import os
import liballinit
import liblogging
import libutil
import libinfrastructure
import libconf
import libdb_relational

log = liblogging.Logger("cloud-services").log

#perform operations from root of repo dir
os.chdir(os.path.dirname(os.path.realpath(__file__)) + "/../")

configs = libconf.getLoadedConfigs()
ecsClient = boto3.client("ecs")
autoScalingClient = boto3.client('application-autoscaling')
mySession = boto3.session.Session()
myRegion = mySession.region_name
roleARN = libinfrastructure.getAppRoleARN()
appName = libconf.getAppName(configs)

def registerTaskDefinitions(sName):
    service = configs["appServices"][sName]
    serviceURI = libinfrastructure.getECRServiceRepoURI(sName)
    serviceName = libconf.generateCompleteAppServiceName(sName, configs)
    serviceNamePostfix = libconf.generateAppServiceNamePostfix(sName, configs)
    log("Registering task definition for '" + serviceName + "'...")
    containerDefinitions = [
        {
            "name": serviceName,
            "cpu": service["cpu"],
            "memory": service["memory"],
            "essential": True,
            "image": serviceURI,
            "portMappings": [
                {
                    "containerPort": service["port"],
                    "hostPort": service["port"],
                    "protocol": "tcp"
                }
            ],
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-create-group": "true",
                    "awslogs-group": appName,
                    "awslogs-region": myRegion,
                    "awslogs-stream-prefix": serviceNamePostfix
                }                    
            }
        }
    ]
    taskResponse = ecsClient.register_task_definition(family = serviceName, taskRoleArn = roleARN, executionRoleArn = roleARN, networkMode = "awsvpc", requiresCompatibilities = [ "FARGATE" ], tags = configs["aws"]["tagsL"], containerDefinitions = containerDefinitions, cpu = str(service["cpu"]), memory = str(service["memory"]))
    log("Registered task definition for '" + serviceName + "'.")

def attemptToRemoveServices(sName):
    service = configs["appServices"][sName]
    serviceName = libconf.generateCompleteAppServiceName(sName, configs)
    sresponse = { "services": [] }
    try:
        sresponse = ecsClient.describe_services(cluster = serviceName, services = [serviceName])
    except Exception as e:
        log("Unable to describe service '" + serviceName + "'. Probably just doesn't exist. " + str(e))
    if len(sresponse["services"]) > 0:
        if sresponse["services"][0]["status"] in ["ACTIVE"]:
            log("Service '" + serviceName + "' exists (" + sresponse["services"][0]["status"] + "), so deleting...")
            ecsClient.delete_service(cluster = serviceName, service = serviceName, force = True)

def attemptToDeleteCluster(sName):
    service = configs["appServices"][sName]
    serviceName = libconf.generateCompleteAppServiceName(sName, configs)
    log("Creating '" + serviceName + "' cluster...")
    for x in range(1000):
        try:
            sresponse = ecsClient.describe_services(cluster = serviceName, services = [serviceName])
            if len(sresponse["services"]) > 0:
                if sresponse["services"][0]["status"] in ["DRAINING"]:
                    log("Service '" + serviceName + "' is currently draining. Waiting...")
                else:
                    break
                time.sleep(x % 3)
        except Exception as e:
            log("Unable to describe service '" + serviceName + "'. Probably just doesn't exist. " + str(e))
            break
    cresponse = { "clusters": [] }
    try:
        cresponse = ecsClient.describe_clusters(clusters = [serviceName])
    except Exception as e:
        log("Unable to describe cluster '" + serviceName + "'. Probably just doesn't exist. " + str(e))
        pass
    if len(cresponse["clusters"]) > 0:
        log("Deleting cluster '" + serviceName + "'...")
        try:
            dresponse = ecsClient.delete_cluster(cluster = serviceName)
            log("Deleted cluster '" + serviceName + "'.")
        except Exception as e:
            log("Could not delete cluster '" + serviceName + "'. Probably not a problem. " + str(e))
    settings = [
        {
            "name": "containerInsights",
            "value": "enabled"
        }
    ]
    clusterResponse = ecsClient.create_cluster(clusterName = serviceName, tags = configs["aws"]["tagsL"], settings = settings)
    log("Created '" + serviceName + "' cluster.")

def createService(sName):
    service = configs["appServices"][sName]
    serviceName = libconf.generateCompleteAppServiceName(sName, configs)
    log("Creating service for '" + serviceName + "'...")
    loadBalancers = [
        {
            "targetGroupArn": libinfrastructure.getTargetGroupARN(serviceName),
            "containerName": serviceName,
            "containerPort": service["port"]
        }
    ]
    networkConfiguration = {
        "awsvpcConfiguration": {
            "subnets": configs["aws"]["subnets"],
            "securityGroups": configs["aws"]["securityGroups"],
            "assignPublicIp": "ENABLED"
        }
    }
    ecsClient.create_service(cluster = serviceName, serviceName = serviceName, desiredCount = service["desiredContainers"], taskDefinition = serviceName, launchType = "FARGATE", loadBalancers = loadBalancers, networkConfiguration = networkConfiguration)
    log("Done creating service '" + serviceName + "'.")

def addScalingPolicy(sName):
    cpu = configs["aws"]["autoScaleCPUPercent"]
    mem = configs["aws"]["autoScaleMemPercent"]
    service = configs["appServices"][sName]
    serviceName = libconf.generateCompleteAppServiceName(sName, configs)
    log("Creating auto-scaling policy for '" + serviceName + "'...")
    resourceID = "service/" + serviceName + "/" + serviceName
    scalableDimension = 'ecs:service:DesiredCount'
    suspendedState = {
        'DynamicScalingInSuspended': False,
        'DynamicScalingOutSuspended': False,
        'ScheduledScalingSuspended': False
    }
    minContainers = service["minContainers"]
    maxContainers = service["maxContainers"]
    autoScalingClient.register_scalable_target(ServiceNamespace='ecs', ResourceId=resourceID, ScalableDimension=scalableDimension, MinCapacity=minContainers, MaxCapacity=maxContainers, RoleARN=roleARN, SuspendedState=suspendedState)
    targetCPUTrackingScalingPolicyConfiguration={
        'TargetValue': cpu,
        'PredefinedMetricSpecification': {
            'PredefinedMetricType': 'ECSServiceAverageCPUUtilization' #|'ECSServiceAverageMemoryUtilization'
        },
        'ScaleOutCooldown': 60,
        'ScaleInCooldown': 60,
        'DisableScaleIn': False
    }
    targetMemoryTrackingScalingPolicyConfiguration={
        'TargetValue': mem,
        'PredefinedMetricSpecification': {
            'PredefinedMetricType': 'ECSServiceAverageMemoryUtilization'
        },
        'ScaleOutCooldown': 60,
        'ScaleInCooldown': 60,
        'DisableScaleIn': False
    }
    autoScalingClient.put_scaling_policy(PolicyName=appName + "-track-cpu", ServiceNamespace='ecs', ResourceId=resourceID, ScalableDimension=scalableDimension, PolicyType='TargetTrackingScaling', TargetTrackingScalingPolicyConfiguration=targetCPUTrackingScalingPolicyConfiguration)
    autoScalingClient.put_scaling_policy(PolicyName=appName + "-track-memory", ServiceNamespace='ecs', ResourceId=resourceID, ScalableDimension=scalableDimension, PolicyType='TargetTrackingScaling', TargetTrackingScalingPolicyConfiguration=targetMemoryTrackingScalingPolicyConfiguration)
    log("Done creating auto-scaling policy for '" + serviceName + "'.")

def run(serviceName = None):
    sName = serviceName
    log("Building app services...")

    if configs["aws"]["usingAWS"]:
        #register task definitions
        if serviceName == None:
            for sName in configs["appServices"]:
                registerTaskDefinitions(sName)
        else:
            registerTaskDefinitions(sName)

        #attempt to remove services
        if serviceName == None:
            for sName in configs["appServices"]:
                attemptToRemoveServices(sName)
        else:
            attemptToRemoveServices(sName)

        #attempt to delete then create cluster
        if serviceName == None:
            for sName in configs["appServices"]:
                attemptToDeleteCluster(sName)
        else:
            attemptToDeleteCluster(sName)

        #create services
        if serviceName == None:
            for sName in configs["appServices"]:
                createService(sName)
        else:
            createService(sName)

        #add scaling policy
        if serviceName == None:
            for sName in configs["appServices"]:
                if configs["appServices"][sName]["autoScale"]:
                    addScalingPolicy(sName)
        else: 
            if configs["appServices"][sName]["autoScale"]:
                addScalingPolicy(sName)

    log("Done building app services.", waitForSend = True)
import sys

sys.dont_write_bytecode = True
sys.path.append("../libraries")

import boto3

import liballinit
import libconf
import liblogging

log = liblogging.Logger('create-bucket').log

def createAppS3Bucket():
    mySession = boto3.session.Session()
    myRegion = mySession.region_name
    bucketName = libconf.getAppBucketName()
    log("Creating S3 bucket '" + bucketName + "'...")
    s3 = boto3.client('s3')
    response = s3.list_buckets()
    for bucket in response["Buckets"]:
        if bucketName == bucket["Name"]:
            log("Bucket '" + bucketName + "' exists.")
            return
    params = {
        "CreateBucketConfiguration": {
            "LocationConstraint": myRegion
        },
        "Bucket": bucketName
    }
    s3.create_bucket(**params)
    log("Done creating '" + bucketName + "' bucket.", waitForSend = True)
    return

def run():
    createAppS3Bucket()
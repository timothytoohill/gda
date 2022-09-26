import sys

sys.dont_write_bytecode = True

import json
import datetime
import paho.mqtt.client as mqtt
import threading
import time
import libutil

isMQTTClientConnected = False
publishLock = threading.Lock()
reconnectDelaySeconds = 15
mqttClient = mqtt.Client()

class Logger:
    def __init__(self, topic):
        self.topic = topic
    def log(self, message, topic = None, waitForSend=False):
        t = self.topic
        sessionID = self.getSessionID()
        if not sessionID == None:
            if len(sessionID) > 0:
                t = t + "/" + sessionID
        if not topic == None:
            if len(topic) > 0:
                t = t + "/" + topic
        log(message, t, waitForSend=waitForSend)
    def setSessionID(self, sessionID = ""):
        currentThread = threading.current_thread()
        currentThread.name = libutil.getThisInstanceID() + ":" + sessionID
    def getSessionID(self):
        currentThread = threading.current_thread()
        vals = currentThread.name.split(":")
        if vals[0] == libutil.getThisInstanceID():
            return vals[1]
        return None

def publishMessage(topic, message, qos = 0, retain = False, waitForSend = False):
    import libconf #imported here so as to avoid circular importing
    global mqttClient
    global publishLock
    global isMQTTClientConnected

    if isMQTTClientConnected:
        configs = libconf.getLoadedConfigs()
        if len(configs) > 0:
            payload = json.dumps({ "dateTime": datetime.datetime.now().isoformat(), "message": message })
            fullTopic = libconf.generateCompleteAppServiceTopic(topic)
            response = None
            with publishLock:
                try:
                    response = mqttClient.publish(fullTopic, payload, qos, retain)
                except Exception as e: #can't let this stop anything - just print for now
                    print(e)
            if waitForSend:
                try:
                    response.wait_for_publish()
                except Exception as e:
                    print(e)
    return

def on_mqtt_connect(client, userdata, flags, rc):
    global isMQTTClientConnected
    log("MQTT client connected with result code: " + str(rc) + ".")
    isMQTTClientConnected = True
    return

def on_mqtt_message(client, userdata, msg):
    print(msg.topic + ": " + str(msg.payload))
    return

def on_mqtt_disconnect(client, userdata, rc):
    global isMQTTClientConnected
    isMQTTClientConnected = False
    log("MQTT client disconnected with result code: " + str(rc) + ".")
    connectMQTTClientOnThread(False) #might need to keep an eye on this
    return

def connectMQTTClient(address, port):
    import libconf #imported here so as to avoid circular importing
    global mqttClient
    mqttClient.loop_stop()
    configs = libconf.getLoadedConfigs()
    mqttClient.reinitialise(client_id = libconf.generateCompleteAppServiceID(), clean_session=True, userdata=None)
    mqttClient.reconnect_delay_set(1000000, 100000000)
    mqttClient.on_connect = on_mqtt_connect
    mqttClient.on_message = on_mqtt_message
    mqttClient.on_disconnect = on_mqtt_disconnect
    mqttClient.username_pw_set(username = configs["appServices"]["mq"]["username"], password = configs["appServices"]["mq"]["password"])
    mqttClient.connect(address, port, 10)

def connectMQTTClientThread(delay = False):
    import libconf #imported here so as to avoid circular importing
    global mqttClient
    configs = libconf.getLoadedConfigs()
    address = libconf.getAddressForService("mq")
    port = configs["appServices"]["mq"]["port"]
    tryCount = 0
    keepGoing = True
    suppressMessages = False
    if delay:
        time.sleep(reconnectDelaySeconds)
    while (tryCount < 1000) and (keepGoing == True):
        try:
            if not suppressMessages:
                log("Connecting MQTT client to " + address + ":" + str(port) + "...")
            connectMQTTClient(address, port)
            tryCount = 0
            mqttClient.loop_start()
            keepGoing = False
        except Exception as e:
            tryCount = tryCount + 1
            if not suppressMessages:
                log("Failed to connect MQTT client for logging: " + str(e) + ". Trying again soon...")
            suppressMessages = not ((tryCount % 10) == 0)
        time.sleep(reconnectDelaySeconds)
    return

def connectMQTTClientOnThread(delay = False):
    connThread = threading.Thread(target = connectMQTTClientThread, args = [delay])
    connThread.daemon = True
    connThread.name = "ConnectMQTTThread"
    connThread.start()
    return

def log(message, topic = "system", includeTime = True, printIt = True, sendIt = True, waitForSend = False):
    msg = topic + ": " + message
    if includeTime:
        msg = str(datetime.datetime.now()) + " " + msg
    if printIt:
        print(msg)
    if sendIt:
        publishMessage(topic, message, waitForSend = waitForSend)
    return

const constant = require("../const")
const Log = require("../log")

// fileprivate
let self = {
    trackerAddr: "",
    trackerPort: "",
    shareId: "",

    announced: false,
    keepingAlive: false,

    keepaliveInterval: undefined,
}

class Self {
    constructor() {

    }

    start(trackerAddr, trackerPort, clientId) {
        if (trackerAddr === undefined) {
            Log.fatal("trackerAddr is undefined")
        }
        Log.debug(`Tracker set to ${trackerAddr}:${trackerPort}`)
        self.trackerAddr = trackerAddr
        self.trackerPort = trackerPort
        self.clientId = clientId
    }

    setShareId(shareId) {
        self.announced = true
        self.shareId = shareId
    }

    announced() {
        return self.announced
    }

    genAnnounceMessage() {
        return Buffer.from(JSON.stringify({ id: this.clientId, action: constant.__AnnounceAction }))
    }

    genAliveMessage() {
        return Buffer.from(JSON.stringify({ id: this.clientId, action: constant.__AliveAction }))
    }

    genAnswerMessage() {
        return Buffer.from(JSON.stringify({ id: this.clientId, action: constant.__AnswerAction }))
    }

    genKnockMessage() {
        return Buffer.from(JSON.stringify({ id: this.clientId, action: constant.__KnockAction }))
    }

    trackerAddr() {
        return self.trackerAddr
    }

    trackerPort() {
        return self.trackerPort
    }

    isKeepingAlive() {
        return self.keepingAlive
    }


}

module.exports = Self

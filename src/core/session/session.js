const constant = require("../const")
const Log = require("../log")

// fileprivate
let self = {
    trackerAddr: "",
    trackerPort: "",
    shareId: "",

    announced: false,
    keepingAlive: false,

    announceInterval: undefined,
    pushInterval: undefined,
    keepAliveInterval: undefined,
}

class Self {
    constructor() {

    }

    start(trackerAddr, trackerPort, shareId) {
        if (trackerAddr === undefined) {
            Log.fatal("trackerAddr is undefined")
        }
        Log.debug(`Tracker set to ${trackerAddr}:${trackerPort}`)
        self.trackerAddr = trackerAddr
        self.trackerPort = trackerPort
        self.shareId = shareId
    }

    setShareId(shareId) {
        this.setAnnounced(true)
        self.shareId = shareId
    }

    hasAnnounced() {
        return self.announced
    }

    setAnnounced(announced) {
        self.announced = announced
    }

    setAnnounceInterval(announceInterval) {
        self.announceInterval = announceInterval
    }

    clearAnnounceInterval() {
        if (self.announceInterval !== undefined) {
            clearInterval(self.announceInterval)
            self.announceInterval = undefined
        }
    }

    genAnnounceMessage() {
        return Buffer.from(JSON.stringify({ action: constant.__AnnounceAction }))
    }

    genAliveMessage() {
        return Buffer.from(JSON.stringify({ action: constant.__AliveAction }))
    }

    genAnswerMessage() {
        return Buffer.from(JSON.stringify({ action: constant.__AnswerAction }))
    }

    genKnockMessage() {
        return Buffer.from(JSON.stringify({ action: constant.__KnockAction }))
    }

    genDisconnectMessage() {
        return Buffer.from(JSON.stringify({ action: constant.__DisconnectAction }))
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

    setKeepingAlive(keepingAlive) {
        self.keepingAlive = keepingAlive
    }

    setKeepAliveInterval(keepAliveInterval) {
        self.keepAliveInterval = keepAliveInterval
    }

    clearKeepAliveInterval() {
        if (self.keepAliveInterval !== undefined) {
            clearInterval(self.keepAliveInterval)
            self.keepAliveInterval = undefined
        }
    }

    hasPushed() {
        return self.pushed
    }

    setPushed(pushed) {
        self.pushed = pushed
    }

    setPushInterval(pushInterval) {
        self.pushInterval = pushInterval
    }

    clearPushInterval() {
        if (self.pushInterval !== undefined) {
            clearInterval(self.pushInterval)
            self.pushInterval = undefined
        }
    }
}

module.exports = Self

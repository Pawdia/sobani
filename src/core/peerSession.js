class PeerSession {
    addr = ""
    port = ""
    shareId = ""
    lastSeen = undefined
    
    // human readable status
    status = ""

    // class variable
    static peer = new Map()

    // find peer
    // maybe undefined
    static findPeer(addr, port) {
        return this.peer.get(`${addr}:${port}`)
    }

    // find peer
    // if peer not exists, then create a new one
    static findPeerOrInsert(addr, port, shareId) {
        let ret = this.findPeer(addr, port)
        if (ret === undefined) {
            this.peer.set(`${addr}:${port}`, new PeerSession(addr, port, shareId))
        }
        return this.peer.get(`${addr}:${port}`)
    }
    
    // find peer by shareId
    static findPeerByShareId(shareId) {
        let keys = this.peer.keys()
        for (let key of keys) {
            let peer = this.peer.get(key)
            if (peer.shareId === shareId) {
                return peer
            }
        }
        return undefined
    }

    static connectedPeers() {
        let connectedPeers = new Array()
        let keys = this.peer.keys()
        for (let key of keys) {
            let peer = this.peer.get(key)
            if (peer.knocked) {
                connectedPeers.push(peer)
            }
        }
        return connectedPeers
    }

    constructor(addr, port, shareId) {
        this.addr = addr
        this.port = port
        this.shareId = shareId
        this.updateLastSeen()
    }

    description() {
        return `[${this.shareId}]@${this.addr}:${this.port}, last seen at ${this.lastSeen}`
    }

    disconnect() {
        this.clearAliveInterval()
        this.clearIncomeInterval()

        this.disconnected = true
        this.knocked = false
        this.pushed = false
    }

    isDisconnected() {
        return this.disconnected
    }

    setDisconnected(isDisconnected) {
        this.disconnected = isDisconnected
    }

    isKnocked() {
        return this.knocked        
    }

    setKnocked(knocked) {
        this.knocked = knocked
    }

    setAliveInterval(aliveInterval) {
        this.aliveInterval = aliveInterval
    }

    clearAliveInterval() {
        if (this.aliveInterval !== undefined) {
            clearInterval(this.aliveInterval)
            this.aliveInterval = undefined
        }
    }

    setIncomeInterval(incomeInterval) {
        this.incomeInterval = incomeInterval
    }

    clearIncomeInterval() {
        if (this.incomeInterval !== undefined) {
            clearInterval(this.incomeInterval)
            this.incomeInterval = undefined
        }
    }

    updateLastSeen() {
        this.lastSeen = new Date()
    }

    playChunk(chunk) {
        this.updateLastSeen()
        console.log(this.client_id, chunk.length)
    }
}

module.exports = PeerSession

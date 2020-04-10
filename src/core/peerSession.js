class peerSession {
    addr = ""
    port = ""
    clientID = ""
    lastSeen = undefined
    
    // human readable status
    status = ""

    // internal status
    knocked = false
    disconnected = true

    // internal intervals
    knockedInterval = undefined

    // namespace Session    ->  public static PeerControl
    //                      ->  public Peer 
    //                      ->  public static AudioControl
    //                      ->  public Audio

    // class variable
    static peer = new Map()
    // peerSession.peer

    // find peer
    // maybe undefined
    static findPeer(addr, port) {
        return this.peer[`${addr}:${port}`]
    }
    // find peer
    // if peer not exists, then create a new one
    static findPeerOrInsert(addr, port) {
        let ret = this.findPeer(addr, port)
        if (ret === undefined) {
            this.peer[`${addr}:${port}`] = new peerSession(addr, port)
        }
        return this.peer[`${addr}:${port}`]
    }

    static getAnswerBuffer(selfIdentity) {
        return Buffer.from(JSON.stringify({ "id": selfIdentity, "action": "answer" }))
    }

    constructor(addr, port) {
        this.addr = addr
        this.port = port
        this.updateLastSeen()
    }

    disconnect() {
        this.incomeInterval === undefined ? 0 : clearInterval(this.incomeInterval)
        this.knockedInterval === undefined ? 0 : clearInterval(this.knockedInterval)
        this.pushedInterval === undefined ? 0 : clearInterval(this.pushedInterval)

        this.disconnected = true
        this.knocked = false
        this.pushed = false
    }

    updateLastSeen() {
        this.lastSeen = new Date()
    }

    playChunk(chunk) {
        this.updateLastSeen()
        console.log(this.client_id, chunk.length)
    }
}

module.exports = peerSession

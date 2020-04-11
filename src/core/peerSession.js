class peerSession {
    addr = ""
    port = ""
    shareId = ""
    lastSeen = undefined
    
    // human readable status
    status = ""

    // internal status
    knocked = false
    disconnected = true

    // internal intervals
    knockedInterval = undefined
    aliveInterval = undefined

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
        return this.peer.get(`${addr}:${port}`)
    }
    // find peer
    // if peer not exists, then create a new one
    static findPeerOrInsert(addr, port, shareId) {
        let ret = this.findPeer(addr, port)
        if (ret === undefined) {
            this.peer.set(`${addr}:${port}`, new peerSession(addr, port, shareId))
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
        this.incomeInterval === undefined ? 0 : clearInterval(this.incomeInterval)
        this.knockedInterval === undefined ? 0 : clearInterval(this.knockedInterval)
        this.pushedInterval === undefined ? 0 : clearInterval(this.pushedInterval)
        this.aliveInterval === undefined ? 0 : clearInterval(this.aliveInterval)

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

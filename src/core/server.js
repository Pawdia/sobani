// Dependencies
const dgram = require("dgram")
const server = dgram.createSocket('udp4')

// Local
const constant = require("./const")
const PeerSession = require("./peersession")
const Log = require("./log")

let self = {
    server,
    events: new Map()
}

class Server {
    constructor() {

    }

    start() {
        self.server.on('listening', () => {
            const address = server.address()
            console.log(`server listening ${address.address}:${address.port}`)
        })
        
        self.server.on('message', (msg, rinfo) => {
            let remotePeer = PeerSession.findPeer(rinfo.address, rinfo.port)
            if (msg.length >= constant.__AudiobufPrefixLength && msg.slice(0, constant.__AudiobufPrefixLength).toString() === constant.__AudiobufPrefix) {
                self.emit(constant.__AudiobufPrefix, msg.slice(constant.__AudiobufPrefixLength), remotePeer)
            } else {
                try {
                    let resp = JSON.parse(msg)
                    let remotePeer = PeerSession.findPeer(rinfo.address, rinfo.port)

                    if (resp.action === constant.__AnnouncedAction) {
                        this.emit(resp.action, resp)
                    } else if (resp.action === constant.__PushedAction) {
                        // Server -> A
                        // B addr:port
                        let peeraddr_info = resp.data.peeraddr.split(":")
                        remotePeer = PeerSession.findPeerOrInsert(peeraddr_info[0], peeraddr_info[1], resp.data.peerShareId)
                        this.emit(resp.action, resp, remotePeer)
                    } else if (resp.action === constant.__KnockAction) {
                        this.emit(resp.action, resp, remotePeer, rinfo)
                    } else if (resp.action === constant.__IncomeAction) {
                        // Server -> B
                        // A addr:port
                        let push_id_info = resp.data.peeraddr.split(":")
                        remotePeer = PeerSession.findPeerOrInsert(push_id_info[0], push_id_info[1], resp.data.peerShareId)
                        this.emit(resp.action, resp, remotePeer)
                    } else if (resp.action === constant.__ChatAction) {
                        this.emit(resp.action, resp, remotePeer, rinfo)
                    } else if (resp.action === constant.__AnswerAction) {
                        this.emit(resp.action, resp, remotePeer, rinfo)
                    } else if (resp.action === constant.__AliveAction) {
                        this.emit(resp.action, resp, remotePeer, rinfo)
                    } else if (resp.action === constant.__DisconnectAction) {
                        this.emit(resp.action, resp, remotePeer, rinfo)
                    } else {
                        Log.warning(`[${resp.action}] Received ${resp.action} msg from ${rinfo.address}:${rinfo.port}, ` + 
                        `however, Sobani cannot understand this action. This ${resp.action} msg will be ignored.`)
                    }
                } catch (err) {
                    Log.warning(`[!] Received ${msg} from ${rinfo.address}:${rinfo.port}, ` + 
                    `however, Sobani cannot parse this msg. This msg will be ignored. ${err}`)
                }
            }
        })

        self.server.bind()
    }

    on(event, cb) {
        self.events.set(event, cb)
    }

    emit(event, ...args) {
        if (self.events.has(event)) {
            let cb = self.events.get(event)
            cb(...args)
        }
    }

    send(data, port, addr, cb) {
        self.server.send(data, port, addr, cb)
    }
}

module.exports = Server

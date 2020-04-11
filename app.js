// Internal
const dgram = require("dgram")
const server = dgram.createSocket('udp4')
const process = require('process')

// Dependencies
const fs = require("fs")
const path = require("path")
const { app, Menu, Tray, BrowserWindow, ipcMain, dialog, globalShortcut, shell } = require("electron")
const nativeImage = require("electron").nativeImage

// Global
const Global = require("./src/core/storage/global")
const appConfig = require("./src/config/app.json")
let appDataPath = path.join(app.getPath("appData"), "Sobani")
let configPath = path.join(appDataPath, "config.json")

Global.Add("config", undefined)
Global.Add("appConfig", appConfig)
Global.Add("appDataPath", appDataPath)
Global.Add("configPath", configPath)

// Local
const init = require("./src/core/init")
const hash = require("./src/utils/hash")
const audio = require("./src/core/audio")
const peerSession = require("./src/core/peerSession")
const Self = require("./src/core/session/session")
const constant = require("./src/core/const")
const Log = require("./src/core/log")

app.name = "Sobani"

let tracker = undefined
let self = new Self()

const nowTime = new Date().toString()
const clientIdentity = hash.sha256(nowTime).substring(0, 8)
const audioPrefix = Buffer.from(constant.__AudiobufPrefix)

// todo: disconnected: remote peer
let disconnected = false

const isMac = process.platform === 'darwin'
const isWin = process.platform === 'win32'
const isLinux = process.platform === 'linux'
// const isFreeBSD = process.platform === 'freebsd'
// const isOpenBSD = process.platform === 'openbsd'

// Image and Icon
let icon = nativeImage.createFromPath(path.join(__dirname, "src/assets/icon.png"))
let trayIcon = nativeImage.createFromPath(path.join(__dirname, "src/assets/tray.png"))
let tray = undefined
let window = undefined

function createWindow() {
    window = new BrowserWindow({
        width: 800,
        height: 600,
        title: "Sobani",
        backgroundColor: "#FFFFFF",
        icon: icon,
        resizable: false,
        webPreferences: {
            // nodeIntegration: true,
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            preload: path.join(__dirname, "preload.js") // use a preload script
        }
    })

    // Set Icon
    // window.setIcon(path.join(__dirname, "src/assets/icon.png"))

    // Load start up page
    window.loadFile("index.html")

    // Open DevTools
    // window.webContents.openDevTools()
}

let TrayMenu = [
    {
        label: "Hide",
        click: function () {
            toggleWindow()
        }
    },
    {
        label: "Audio Input",
        submenu: audio.getAudioContextMenu().input
    },
    {
        label: "Audio Output",
        submenu: audio.getAudioContextMenu().output
    },
    {
        label: "Mono",
        click: function () {

        }
    },
    {
        label: "Quit",
        click: function () {
            app.quit()
        }
    }
]

// Tray and Status bar
function createTray() {
    tray = new Tray(trayIcon)

    const contextMenu = Menu.buildFromTemplate(TrayMenu)

    tray.setToolTip("Sobani")
    tray.setContextMenu(contextMenu)
}

async function toggleWindow() {
    window.isVisible() ? window.hide() : window.show()
}

async function updateToWindow(info) {
    window.webContents.send("control", info)
}

async function updateAnnouncedToWindow(shareId) {
    window.webContents.send("announced", shareId)
}

async function updateIndicatorToWindow(update) {
    update.status === "connected" ? disconnected = false : 0
    update.status === "disconnected" ? disconnected = true : 0
    window.webContents.send("indicator", update)
}

// Server Listening
server.on('listening', () => {
    const address = server.address()
    console.log(`server listening ${address.address}:${address.port}`)
})

// Server bind
server.bind()

// Application Quiting Function
function quitApp() {
    audio.quit()
    app.quit()
}

Global.Add("quitApp", quitApp)

// When ready
app.on("ready", () => {
    let configErrored = false

    createTray()
    createWindow()

    if (appConfig.debug) {
        init.debug()
    }
    else {
        init.standard()
    }
    
    // Key control
    // macOS or Linux Command + Q
    globalShortcut.register('CommandOrControl+Q', quitApp)
    // Windows & Linux
    globalShortcut.register('Alt+F4', quitApp)
    // Disable refresh
    if (!appConfig.development) {
        globalShortcut.register("CommandOrControl+R", () => { return undefined })
        globalShortcut.register("F5", () => { return undefined })
    }
    
    // Announce to tracker when user interface gets ready
    tracker = Global.Read("tracker")
    self.start(tracker.host, tracker.port, clientIdentity)
    setInterval(() => {
        if (!self.announced()) {
            server.send(self.genAnnounceMessage(), self.trackerPort(), self.trackerAddr(), (err) => {
                if (err) Log.fatal(err)
            })
        }
    }, 1000)
})

// Window close control
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        audio.quit()
        app.quit()
    }
})

// Window activated
app.on("active", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
    TrayMenu[0].label = "Hide"
    tray.setContextMenu(Menu.buildFromTemplate(TrayMenu))
})

// Window deactivated
app.on("browser-window-blur", () => {
    TrayMenu[0].label = "Show"
    tray.setContextMenu(Menu.buildFromTemplate(TrayMenu))
})

// Main
server.on('message', (msg, rinfo) => {
    if (msg.length >= 8 && msg.slice(0, 8).toString() === constant.__AudiobufPrefix) {
        // todo: using audio session and audio-mixer
        let remotePeer = peerSession.findPeer(rinfo.address, rinfo.port)
        if (!remotePeer.disconnected) {
            audio.opusDecoder.write(msg.slice(8))
        } else {
            Log.warning(`[${constant.__AudiobufPrefix}] Received ${constant.__AudiobufPrefix} from ${rinfo.address}:${rinfo.port}, ` + 
            `however, Sobani cannot find this peer in previous record. This msg will be ignored.`)
        }
    } else {
        try {
            resp = JSON.parse(msg)
            if (resp.action === constant.__AnnouncedAction) {
                Log.debug(`[${resp.action}] Tracker assigned shareId is ${resp.data.shareId}`)
                self.setShareId(resp.data.shareId)
                updateAnnouncedToWindow(resp.data.shareId)
                // keep alive with tracker
                if (!self.isKeepingAlive()) {
                    self.keepingAlive = true
                    let aliveMessage = self.genAliveMessage()
                    self.keepaliveInterval = setInterval(() => {
                        server.send(aliveMessage, self.trackerPort(), self.trackerAddr(), (err) => {
                            if (err) dialog.showErrorBox(err.message, err.stack)
                        })
                    }, 2000)
                }
            } else if (resp.action === constant.__PushedAction) {
                // Server -> A
                self.pushed = true
                self.pushedInterval === undefined ? 0 : clearInterval(self.pushedInterval)
                self.pushed = false
                // "5.6.7.8:2333"
                peeraddr_info = resp.data.peeraddr.split(":")
                // B addr:port
                let remotePeer = peerSession.findPeerOrInsert(peeraddr_info[0], peeraddr_info[1], resp.data.peerShareId)
                Log.debug(`[${resp.action}] Remote peer resolved ${remotePeer.description()}`)

                // A -> NAT A -> NAT B -!> B
                // NAT A will wait for B resp
                const message = self.genKnockMessage()
                server.send(message, remotePeer.port, remotePeer.addr, (err) => {
                    if (err) dialog.showErrorBox(err.message, err.stack)
                })
            } else if (resp.action === constant.__KnockAction) {
                let remotePeer = peerSession.findPeer(rinfo.address, rinfo.port)
                if (remotePeer !== undefined) {
                    Log.debug(`[${resp.action}] Received ${resp.action} msg from peer ${remotePeer.description()}`)
                    if (!remotePeer.knocked) {
                        remotePeer.knockedInterval = setInterval(() => {
                            const alivemessage = self.genAliveMessage()
                            server.send(alivemessage, remotePeer.port, remotePeer.addr, (err) => {
                                if (err) dialog.showErrorBox(err.message, err.stack)
                            })
                        }, 2000)
                    }
                    remotePeer.knocked = true
                    remotePeer.disconnected = false
                    remotePeer.updateLastSeen()
                    updateToWindow(`peer knocked: ${msg} from ${remotePeer.shareId}`)
                    updateIndicatorToWindow({ status: "connected", id: remotePeer.shareId })
                    const message = self.genAnswerMessage()
                    server.send(message, remotePeer.port, remotePeer.addr, (err) => {
                        if (err) dialog.showErrorBox(err.message, err.stack)
                    })
                } else {
                    Log.warning(`[${resp.action}] Received ${resp.action} msg from ${rinfo.address}:${rinfo.port}, ` + 
                    `however, Sobani cannot find this peer in previous record. This ${resp.action} msg will be ignored.`)
                }
            } else if (resp.action === constant.__IncomeAction) {
                // Server -> B
                // A addr:port
                push_id_info = resp.data.peeraddr.split(":")

                // A <- NAT A <- NAT B <- B
                // Cus' NAT A is waiting for B resp
                // so NAT A will forward this resp to A
                // at this point
                // connection between A and B will become active on NAT A
                let remotePeer = peerSession.findPeerOrInsert(push_id_info[0], push_id_info[1], resp.data.peerShareId)
                Log.debug(`[${resp.action}] Received ${resp.action} msg from tracker. Remote peer is ${remotePeer.description()}`)

                const message = self.genKnockMessage()
                updateToWindow(`prepare to connect to ${resp.data.peeraddr}`)
                remotePeer.incomeInterval = setInterval(() => {
                    if (!remotePeer.knocked) {
                        server.send(message, remotePeer.port, remotePeer.addr, (err) => {
                            if (err) dialog.showErrorBox(err.message, err.stack)
                        })
                    } else {
                        clearInterval(remotePeer.incomeInterval)
                        remotePeer.disconnected = false
                        updateIndicatorToWindow({ status: "connected", id: resp.id })
                    }
                }, 1000)
            } else if (resp.action === constant.__ChatAction) {
                // todo: ChatSession
                let remotePeer = peerSession.findPeer(rinfo.address, rinfo.port)
                if (remotePeer !== undefined) {
                    Log.debug(`[${resp.action}] Received ${resp.action} msg, ${resp.msg} from ${remotePeer.shareId}`)
                }  else {
                    Log.warning(`[${resp.action}] Received ${resp.action} msg from ${rinfo.address}:${rinfo.port}, ` + 
                    `however, Sobani cannot find this peer in previous record. This ${resp.action} msg will be ignored.`)
                }
            } else if (resp.action === constant.__AnswerAction) {
                let remotePeer = peerSession.findPeer(rinfo.address, rinfo.port)
                if (remotePeer !== undefined) {
                    remotePeer.knocked = true
                    remotePeer.disconnected = false

                    Log.debug(`[${resp.action}] Received ${resp.action} msg from remote peer ${remotePeer.description()}`)

                    updateToWindow(`peer answered: ${msg} from ${remotePeer.shareId}`)
                    updateIndicatorToWindow({ status: "connected", id: remotePeer.shareId })

                    remotePeer.aliveInterval = setInterval(() => {
                        const alivemessage = self.genAliveMessage()
                        server.send(alivemessage, remotePeer.port, remotePeer.addr, (err) => {
                            if (err) dialog.showErrorBox(err.message, err.stack)
                        })
                    }, 2000)
                } else {
                    Log.warning(`[${resp.action}] Received ${resp.action} msg from ${rinfo.address}:${rinfo.port}, ` + 
                    `however, Sobani cannot find this peer in previous record. This ${resp.action} msg will be ignored.`)
                }
            } else if (resp.action === constant.__AliveAction) {
                let remotePeer = peerSession.findPeer(rinfo.address, rinfo.port)
                if (remotePeer !== undefined) {
                    remotePeer.updateLastSeen()

                    // todo: display last seen on UI
                    let date = new Date()
                    // last seen at xxxxx
                    window.webContents.send("lastseen", [date.getHours(), date.getMinutes(), date.getSeconds()].join(':'))
                    // updateIndicatorToWindow("connected")
                    // If A(B) received "disconnect" action,
                    // clear all intervals and disconnect the current session
                } else {
                    Log.warning(`[${resp.action}] Received ${resp.action} msg from ${rinfo.address}:${rinfo.port}, ` + 
                    `however, Sobani cannot find this peer in previous record. This ${resp.action} msg will be ignored.`)
                }
            } else if (resp.action === constant.__DisconnectAction) {
                let remotePeer = peerSession.findPeer(rinfo.address, rinfo.port)
                if (remotePeer !== undefined) {
                    if (!remotePeer.disconnected) {
                        // todo: disconnect with `remotePeer.shareId`
                        updateIndicatorToWindow({ status: "disconnected" })
                        remotePeer.disconnect()
                        Log.debug(`[${resp.action}] Received ${resp.action} msg from remote peer ${remotePeer.description()}`)
                    } else {
                        Log.debug(`[${resp.action}] Received duplicated ${resp.action} msg from remote peer ${remotePeer.description()}. This msg will be ignored.`)
                    }
                } else {
                    Log.warning(`[${resp.action}] Received ${resp.action} msg from ${rinfo.address}:${rinfo.port}, ` + 
                    `however, Sobani cannot find this peer in previous record. This ${resp.action} msg will be ignored.`)
                }
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

// Opus Buffer
function writeToBuffer(deviceInstance, buf) {
    return new Promise((resolve, reject) => {
        deviceInstance.write(buf)
    })
}

// Opus Decoder
audio.opusDecoder.on('data', async buf => {
    if (audio.outputDevice.deviceInstance !== null) await writeToBuffer(audio.outputDevice.deviceInstance, buf)
})

// Opus Encoder
audio.opusEncoder.on('data', buf => {
    let connectedPeers = peerSession.connectedPeers()
    if (connectedPeers.length > 0) {
        connectedPeers.map(peer => {
            server.send(Buffer.concat([audioPrefix, buf]), peer.port, peer.addr, err => {
                if (err) dialog.showErrorBox(err.message, err.stack)
            })
        })
    }
})

ipcMain.on("connect", (event, args) => {
    // Connection
    Log.debug(`Trying to retrieve ${args.trim()}'s addr and port from tracker`)
    const pushMessage = Buffer.from(JSON.stringify({ shareId: args.trim(), action: constant.__PushAction }))
    self.pushed = false
    self.pushedInterval = setInterval(function () {
        if (!self.pushed) {
            server.send(pushMessage, self.trackerPort(), self.trackerAddr(), (err) => {
                if (err) dialog.showErrorBox(err.message, err.stack)
            })
        }
    }, 1000)
})

ipcMain.on("disconnect", (event, args) => {
    // todo: disconnect with `shareId`
    let shareId = args.trim()
    Log.debug(`[disconnect] from UI, request disconnect with ${shareId}`)
    let remotePeer = peerSession.findPeerByShareId(shareId)
    if (remotePeer !== undefined) {
        remotePeer.disconnect()
        const disconnectMessage = self.genDisconnectMessage()
        Log.debug(`[disconnect] from UI, disconnect message sent to peer ${remotePeer.description()}`)
        server.send(disconnectMessage, remotePeer.port, remotePeer.addr, (err) => {
            if (err) dialog.showErrorBox(err.message, err.stack)
        })
        updateIndicatorToWindow({ status: "disconnected" })
    } else {
        Log.warning(`[disconnect] from UI received, however, Sobani cannot find such remote peer in previous record`)
    }
})

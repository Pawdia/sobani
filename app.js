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
let config = undefined
const audio = require("./src/core/audio")
const peerSession = require("./src/core/peerSession")
const Self = require("./src/core/session/session")
const constant = require("./src/core/const")

app.name = "Sobani"

let tracker = undefined
let self = new Self()

let raddr = ""
let rport = ""

const nowTime = new Date().toString()
const clientIdentity = hash.sha256(nowTime).substring(0, 8)
const audioPrefix = Buffer.from(constant.__AudiobufPrefix)

// todo: disconnected: remote peer
let disconnected = false
let announced = false
let pushed = false
let pushedInterval = undefined
let knocked = false
let knockedInterval = undefined
let incomeInterval = undefined
let keepingAlive = false

let pulsing = {
    retry: 0
}

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

function clearSession() {
    incomeInterval === undefined ? 0 : clearInterval(incomeInterval)
    knockedInterval === undefined ? 0 : clearInterval(knockedInterval)
    pushed = false
    pushedInterval === undefined ? 0 : clearInterval(pushedInterval)
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
                if (err) console.log(err)
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
        // todo: find corresponding AudioSession
        if (knocked) audio.opusDecoder.write(msg.slice(8))
    } else {
        try {
            resp = JSON.parse(msg)
            if (resp.action === constant.__AnnouncedAction) {
                self.setShareId(resp.data.shareId)
                updateAnnouncedToWindow(resp.data.shareId)
                // keep alive with tracker
                if (!self.isKeepingAlive()) {
                    keepingAlive = true
                    let aliveMessage = self.genAliveMessage()
                    setInterval(() => {
                        server.send(aliveMessage, self.trackerPort(), self.trackerAddr(), (err) => {
                            if (err) dialog.showErrorBox(err.message, err.stack)
                        })
                    }, 2000)
                }
            } else if (resp.action === constant.__PushedAction) {
                // Server -> A
                pushed = true
                pushedInterval === undefined ? 0 : clearInterval(pushedInterval)
                // "5.6.7.8:2333"
                peeraddr_info = resp.data.peeraddr.split(":")
                // B addr:port
                let remotePeer = peerSession.findPeerOrInsert(peeraddr_info[0], peeraddr_info[1])
                remotePeer.status = "knock sent"
                // raddr = peeraddr_info[0]
                // rport = peeraddr_info[1]

                // A -> NAT A -> NAT B -!> B
                // NAT A will wait for B resp
                const message = self.genKnockMessage()
                server.send(message, rport, raddr, (err) => {
                    if (err) dialog.showErrorBox(err.message, err.stack)
                })
            } else if (resp.action === constant.__KnockAction) {
                let remotePeer = peerSession.findPeer(rinfo.address, rinfo.port)
                if (remotePeer !== undefined) {
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
                    updateToWindow(`peer knocked: ${msg} from ${remotePeer.addr}:${remotePeer.port}`)
                    updateIndicatorToWindow({ status: "connected", id: resp.id })
                    const message = self.genAnswerMessage()
                    server.send(message, remotePeer.port, remotePeer.addr, (err) => {
                        if (err) dialog.showErrorBox(err.message, err.stack)
                    })
                }
                // raddr = rinfo.address
                // rport = rinfo.port
            } else if (resp.action === constant.__IncomeAction) {
                // Server -> B
                // A addr:port
                push_id_info = resp.data.peeraddr.split(":")

                // A <- NAT A <- NAT B <- B
                // Cus' NAT A is waiting for B resp
                // so NAT A will forward this resp to A
                // at this point
                // connection between A and B will become active on NAT A
                let remotePeer = peerSession.findPeerOrInsert(push_id_info[0], push_id_info[1])
                remotePeer.status = "knock sent"

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
                console.log(`\n-> [${resp.id}]: ${resp.msg}`)
            } else if (resp.action === constant.__AnswerAction) {
                knocked = true
                updateToWindow(`peer answered: ${msg} from ${rinfo.address}:${rinfo.port}`)
                disconnected = false
                updateIndicatorToWindow({ status: "connected", id: resp.id })
                setInterval(() => {
                    const alivemessage = self.genAliveMessage()
                    server.send(alivemessage, rinfo.port, rinfo.address, (err) => {
                        if (err) dialog.showErrorBox(err.message, err.stack)
                    })
                }, 2000)

                raddr = rinfo.address
                rport = rinfo.port
            } else if (resp.action === constant.__AlivedAction) {

                let date = new Date()
                // last seen at xxxxx
                window.webContents.send("lastseen", [date.getHours(), date.getMinutes(), date.getSeconds()].join(':'))
                // updateIndicatorToWindow("connected")
                // If A(B) received "disconnect" action,
                // clear all intervals and disconnect the current session
            } else if (resp.action === constant.__DisconnectAction && raddr === rinfo.address && rport === rinfo.port) {
                let remotePeer = peerSession.findPeer(rinfo.address, rinfo.port)
                if (remotePeer !== undefined && !remotePeer.disconnected) {
                    updateIndicatorToWindow({ status: "disconnected" })
                    remotePeer.disconnect()
                    clearSession()
                }
            }
        } catch (err) {
            console.log(err)
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
    if (knocked) {
        server.send(Buffer.concat([audioPrefix, buf]), rport, raddr, err => {
            if (err) {
                if (pulsing.retry === 4) {
                    dialog.showErrorBox(err.message, err.stack)
                    pulsing.retry = 0
                }
                pulsing.retry++
            }
        })
    }
})

ipcMain.on("connect", (event, args) => {
    // Connection
    const message = Buffer.from(JSON.stringify({ "shareId": args.trim(), "action": "push" }))
    pushedInterval = setInterval(function () {
        if (!pushed) {
            server.send(message, tracker.port, tracker.host, (err) => {
                if (err) dialog.showErrorBox(err.message, err.stack)
            })
        }
    }, 1000)
})

ipcMain.on("disconnect", (event, args) => {
    knocked = false
    clearSession()
    console.log(raddr)
    console.log(rport)
    // let retryTimes = 0
    const disconnectMessage = Buffer.from(JSON.stringify({ "id": clientIdentity, "action": "disconnect" }))
    console.log("disconnect packet sent")
    server.send(disconnectMessage, rport, raddr, (err) => {
        if (err) dialog.showErrorBox(err.message, err.stack)
        raddr = undefined
        rport = undefined
    })
    updateIndicatorToWindow({ status: "disconnected" })
})
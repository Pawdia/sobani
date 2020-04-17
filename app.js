// Internal
const process = require('process')

// Dependencies
const url = require("url")
const path = require("path")
const { app, Menu, Tray, BrowserWindow, ipcMain, dialog, globalShortcut } = require("electron")
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
const PeerSession = require("./src/core/peersession")
const Self = require("./src/core/session/session")
const constant = require("./src/core/const")
const Log = require("./src/core/log")
const Server = require("./src/core/server")

app.name = "Sobani"

let tracker = undefined
let self = new Self()
let server = new Server()

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

if (isWin) {
    app.commandLine.appendSwitch('high-dpi-support', 'true')
    app.commandLine.appendSwitch('force-device-scale-factor', '1')
}

// Image and Icon
let icon = nativeImage.createFromPath(path.join(__dirname, "src/assets/icon.png"))
let trayIcon = nativeImage.createFromPath(path.join(__dirname, "src/assets/tray.png"))
let tray = undefined

/************     From boilerplate     ***********/

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

// Keep a reference for dev mode
let dev = false

if (process.env.NODE_ENV !== undefined && process.env.NODE_ENV === 'development') {
    dev = true
}

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        title: "Sobani",
        backgroundColor: "#FFFFFF",
        icon: icon,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            // contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            preload: path.join(__dirname, "preload.js") // use a preload script
        }
    })

    // and load the index.html of the app.
    let indexPath

    if (dev && process.argv.indexOf('--noDevServer') === -1) {
        indexPath = url.format({
            protocol: 'http:',
            host: 'localhost:8080',
            pathname: 'index.html',
            slashes: true
        })
    } else {
        indexPath = url.format({
            protocol: 'file:',
            pathname: path.join(__dirname, 'dist', 'index.html'),
            slashes: true
        })
    }

    mainWindow.loadURL(indexPath)

    // Don't show until we are ready and loaded
    mainWindow.once('ready-to-show', () => {
        mainWindow.show()

        // Open the DevTools automatically if developing
        if (dev) {
            const { default: installExtension, REACT_DEVELOPER_TOOLS } = require('electron-devtools-installer')

            installExtension(REACT_DEVELOPER_TOOLS)
                .catch(err => console.log('Error loading React DevTools: ', err))
            mainWindow.webContents.openDevTools()
        }
    })

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null
    })

    // Open DevTools
    mainWindow.webContents.openDevTools()
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
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
}

async function updateToWindow(info) {
    mainWindow.webContents.send("control", info)
}

async function updateAnnouncedToWindow(shareId) {
    mainWindow.webContents.send("announced", shareId)
}

async function updateIndicatorToWindow(update) {
    update.status === "connected" ? disconnected = false : 0
    update.status === "disconnected" ? disconnected = true : 0
    mainWindow.webContents.send("indicator", update)
}

// Server listening
server.start()

// Application quiting function
function quitApp() {
    audio.quit()
    app.quit()
}

Global.Add("quitApp", quitApp)

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    createTray()
    createWindow()

    if (appConfig.debug) {
        init.debug()
    }
    else {
        init.standard()
    }
    
    // // Key control
    // // macOS or Linux Command + Q
    // globalShortcut.register('CommandOrControl+Q', quitApp)
    // // Windows & Linux
    // globalShortcut.register('Alt+F4', quitApp)
    // // Disable refresh
    // if (!appConfig.development) {
    //     globalShortcut.register("CommandOrControl+R", () => { return undefined })
    //     globalShortcut.register("F5", () => { return undefined })
    // }
    
    // Announce to tracker when user interface gets ready
    tracker = Global.Read("tracker")
    self.start(tracker.host, tracker.port, clientIdentity)
    self.setAnnounceInterval(setInterval(() => {
        if (!self.hasAnnounced()) {
            server.send(self.genAnnounceMessage(), self.trackerPort(), self.trackerAddr(), (err) => {
                if (err) Log.fatal(err)
            })
        } else {
            self.clearAnnounceInterval()
        }
    }, constant.__AnnounceMessageIntervalMilliSec))
})

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
        audio.quit()
    }
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0 || mainWindow === null) {
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
server.on(constant.__AnnouncedAction, resp => {
    Log.debug(`[${resp.action}] Tracker assigned shareId is ${resp.data.shareId}`)
    self.setShareId(resp.data.shareId)
    updateAnnouncedToWindow(resp.data.shareId)
    // keep alive with tracker
    if (!self.isKeepingAlive()) {
        self.setKeepingAlive(true)
        const aliveMessage = self.genAliveMessage()
        self.setKeepAliveInterval(setInterval(() => {
            server.send(aliveMessage, self.trackerPort(), self.trackerAddr(), (err) => {
                if (err) dialog.showErrorBox(err.message, err.stack)
            })
        }, constant.__AliveMessageIntervalMilliSec))
    }
})

server.on(constant.__PushedAction, (resp, remotePeer) => {
    // Server -> A
    // A -> NAT A -> NAT B -!> B
    // NAT A will wait for B resp
    self.setPushed(true)
    self.clearPushInterval()
    self.setPushed(false)
    
    Log.debug(`[${resp.action}] Remote peer resolved ${remotePeer.description()}`)

    server.send(self.genKnockMessage(), remotePeer.port, remotePeer.addr, (err) => {
        if (err) dialog.showErrorBox(err.message, err.stack)
    })
})

server.on(constant.__KnockAction, (resp, remotePeer, rinfo) => {
    if (remotePeer !== undefined) {
        Log.debug(`[${resp.action}] Received ${resp.action} msg from peer ${remotePeer.description()}`)
        if (!remotePeer.isKnocked()) {
            const aliveMessage = self.genAliveMessage()
            remotePeer.setAliveInterval(setInterval(() => {
                server.send(aliveMessage, remotePeer.port, remotePeer.addr, (err) => {
                    if (err) dialog.showErrorBox(err.message, err.stack)
                })
            }, constant.__AliveMessageIntervalMilliSec))
        }
        remotePeer.setKnocked(true)
        remotePeer.setDisconnected(false)
        remotePeer.updateLastSeen()
        updateToWindow(`peer knocked from ${remotePeer.shareId}`)
        updateIndicatorToWindow({ status: "connected", id: remotePeer.shareId })
        server.send(self.genAnswerMessage(), remotePeer.port, remotePeer.addr, (err) => {
            if (err) dialog.showErrorBox(err.message, err.stack)
        })
    } else {
        Log.warning(`[${resp.action}] Received ${resp.action} msg from ${rinfo.address}:${rinfo.port}, ` + 
        `however, Sobani cannot find this peer in previous record. This ${resp.action} msg will be ignored.`)
    }
})

server.on(constant.__IncomeAction, (resp, remotePeer) => {
    Log.debug(`[${resp.action}] Received ${resp.action} msg from tracker. Remote peer is ${remotePeer.description()}`)

    const message = self.genKnockMessage()
    updateToWindow(`prepare to connect to ${resp.data.peeraddr}`)
    remotePeer.setIncomeInterval(setInterval(() => {
        if (!remotePeer.isKnocked()) {
            server.send(message, remotePeer.port, remotePeer.addr, (err) => {
                if (err) dialog.showErrorBox(err.message, err.stack)
            })
        } else {
            remotePeer.clearIncomeInterval()
            remotePeer.setDisconnected(false)
            updateIndicatorToWindow({ status: "connected", id: remotePeer.shareId })
        }
    }, 1000))
})

server.on(constant.__ChatAction, (resp, remotePeer, rinfo) => {
    // todo: ChatSession
    if (remotePeer !== undefined) {
        Log.debug(`[${resp.action}] Received ${resp.action} msg, ${resp.msg} from ${remotePeer.shareId}`)
    }  else {
        Log.warning(`[${resp.action}] Received ${resp.action} msg from ${rinfo.address}:${rinfo.port}, ` + 
        `however, Sobani cannot find this peer in previous record. This ${resp.action} msg will be ignored.`)
    }
})

server.on(constant.__AnswerAction, (resp, remotePeer, rinfo) => {
    if (remotePeer !== undefined) {
        remotePeer.setKnocked(true)
        remotePeer.setDisconnected(false)

        Log.debug(`[${resp.action}] Received ${resp.action} msg from remote peer ${remotePeer.description()}`)

        updateToWindow(`peer answered from ${remotePeer.shareId}`)
        updateIndicatorToWindow({ status: "connected", id: remotePeer.shareId })

        const aliveMessage = self.genAliveMessage()
        remotePeer.setAliveInterval(setInterval(() => {
            server.send(aliveMessage, remotePeer.port, remotePeer.addr, (err) => {
                if (err) dialog.showErrorBox(err.message, err.stack)
            })
        }, constant.__AliveMessageIntervalMilliSec))
    } else {
        Log.warning(`[${resp.action}] Received ${resp.action} msg from ${rinfo.address}:${rinfo.port}, ` + 
        `however, Sobani cannot find this peer in previous record. This ${resp.action} msg will be ignored.`)
    }
})

server.on(constant.__AliveAction, (resp, remotePeer, rinfo) => {
    if (remotePeer !== undefined) {
        remotePeer.updateLastSeen()

        // todo: display last seen on UI
        let date = new Date()
        // last seen at xxxxx
        mainWindow.webContents.send("lastseen", [date.getHours(), date.getMinutes(), date.getSeconds()].join(':'))
        // updateIndicatorToWindow("connected")
        // If A(B) received "disconnect" action,
        // clear all intervals and disconnect the current session
    } else {
        Log.warning(`[${resp.action}] Received ${resp.action} msg from ${rinfo.address}:${rinfo.port}, ` + 
        `however, Sobani cannot find this peer in previous record. This ${resp.action} msg will be ignored.`)
    }
})

server.on(constant.__DisconnectAction, (resp, remotePeer, rinfo) => {
    if (remotePeer !== undefined) {
        if (!remotePeer.isDisconnected()) {
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
})

server.on(constant.__AudiobufPrefix, (buffer, remotePeer) => {
    // todo: using audio session and audio-mixer
    if (!remotePeer.isDisconnected()) {
        audio.opusDecoder.write(msg.slice(constant.__AudiobufPrefixLength))
    } else {
        Log.warning(`[${constant.__AudiobufPrefix}] Received ${constant.__AudiobufPrefix} from ${rinfo.address}:${rinfo.port}, ` + 
        `however, Sobani cannot find this peer in previous record. This msg will be ignored.`)
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
    let connectedPeers = PeerSession.connectedPeers()
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
    self.setPushed(false)
    self.setPushInterval(setInterval(() => {
        if (!self.hasPushed()) {
            server.send(pushMessage, self.trackerPort(), self.trackerAddr(), (err) => {
                if (err) dialog.showErrorBox(err.message, err.stack)
            })
        }
    }, 1000))
})

ipcMain.on("disconnect", (event, args) => {
    let shareId = args.trim()
    Log.debug(`[disconnect] from UI, request disconnect with ${shareId}`)
    let remotePeer = PeerSession.findPeerByShareId(shareId)
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
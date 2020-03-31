// Internal
const dgram = require("dgram")
const server = dgram.createSocket('udp4')
const process = require('process')

// Dependencies
const path = require("path")
const { app, Menu, Tray, BrowserWindow, ipcMain, dialog, globalShortcut } = require("electron")
const nativeImage = require("electron").nativeImage

// Local
const hash = require("./src/utils/hash")
const appConfig = require("./src/config/app.json")

// Audio Support Dependencies
const prism = require("prism-media")
const portAudio = require("naudiodon")

// Global
app.name = "Sobani"

let tracker = {
    host: "108.61.197.8",
    port: 3000
}

let raddr = ""
let rport = ""

const nowTime = new Date().toString()
const clientIdentity = hash.sha256(nowTime).substring(0, 8)

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

const aliveMessage = Buffer.from(JSON.stringify({ "id": clientIdentity, "action": "alive" }))
const announceMessage = Buffer.from(JSON.stringify({ "id": clientIdentity, "action": "announce" }))

const isMac = process.platform === 'darwin'
const isWin = process.platform === 'win32'
const isLinux = process.platform === 'linux'
// const isFreeBSD = process.platform === 'freebsd'
// const isOpenBSD = process.platform === 'openbsd'

// Preset for Audio properties
const audioPrefix = Buffer.from('audiobuf')
let opusEncoder = new prism.opus.Encoder({
    rate: 48000,
    channels: 2,
    frameSize: 960
})
let opusDecoder = new prism.opus.Decoder({
    rate: 48000,
    channels: 2,
    frameSize: 960
})

// Image and Icon
let icon = nativeImage.createFromPath(path.join(__dirname, "src/assets/icon.png"))
let trayIcon = nativeImage.createFromPath(path.join(__dirname, "src/assets/tray.png"))
let tray = undefined
let window = undefined

// Audio Preparation
let audioOutDevice = {
    started: false,
    deviceInstance: null
}
let audioInDevice = {
    started: false,
    deviceInstance: null
}

let audioDeviceOption = {
    channelCount: 1,
    sampleFormat: portAudio.SampleFormat16Bit,
    sampleRate: 48000,
    deviceId: 0,
    closeOnError: false
}

let sterro = false

function audioContextMenuBuilder(deviceName, deviceId, type) {

    let contextMenuObject = {
        label: `${deviceId}: ${deviceName}`,
        click: function () {
            if (audioOutDevice.started && deviceInstance !== null) {
                console.log("Switching device...")
                deviceInstance.quit()
            }

            console.log("Setting up device...")
            switch (type) {
                case "in":
                    let inOption = audioDeviceOption
                    inOption.deviceId = deviceId
                    console.log(inOption)
                    audioInDevice.deviceInstance = new portAudio.AudioIO({
                        inOptions: inOption
                    })
                    console.log("Input device selected: " + deviceName)
                    audioInDevice.started = true
                    audioInDevice.deviceInstance.start()
                    audioInDevice.deviceInstance.on('data', buf => {
                        if (knocked) {
                            opusEncoder.write(buf)
                        }
                    })
                    break
                case "out":
                    let outOption = audioDeviceOption
                    outOption.deviceId = deviceId
                    audioOutDevice.deviceInstance = new portAudio.AudioIO({
                        outOptions: outOption
                    })
                    console.log("Output device selected: " + deviceName)
                    audioInDevice.started = true
                    audioOutDevice.deviceInstance.start()
                    break
                default:
                    process.exit()
                    break
            }
        }
    }

    return contextMenuObject
}

let inputAudioContextMenu = new Array()
let outputAudioContextMenu = new Array()

let devices = portAudio.getDevices()
devices.forEach(device => {

    // In
    if (device.maxInputChannels > 0) {
        inputAudioContextMenu.push(audioContextMenuBuilder(device.name, device.id, "in"))
    }

    // Out
    if (device.maxOutputChannels > 0) {
        outputAudioContextMenu.push(audioContextMenuBuilder(device.name, device.id, "out"))
    }


    console.log(`[${device.hostAPIName} | ${device.id}] ${device.name}`)
})

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
        submenu: inputAudioContextMenu
    },
    {
        label: "Audio Output",
        submenu: outputAudioContextMenu
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
    knocked = false
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
    if (audioInDevice.deviceInstance != null) audioInDevice.deviceInstance.quit()
    if (audioOutDevice.deviceInstance != null) audioOutDevice.deviceInstance.quit()
    app.quit()
}

// When ready
app.on("ready", () => {
    createTray()
    createWindow()

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
})

// Window close control
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
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
setInterval(() => {
    if (!announced) {
        server.send(announceMessage, tracker.port, tracker.host, (err) => {
            if (err) console.log(err)
        })
    }
}, 1000)

server.on('message', (msg, rinfo) => {
    if (msg.length >= 8 && msg.slice(0, 8).toString() === "audiobuf") {
        if (knocked) opusDecoder.write(msg.slice(8))
    } else {
        try {
            resp = JSON.parse(msg)
            if (resp.action == "announced") {
                announced = true
                updateAnnouncedToWindow(resp.data.shareId)
                // keep alive with tracker
                if (!keepingAlive) {
                    keepingAlive = true
                    setInterval(() => {
                        server.send(aliveMessage, tracker.port, tracker.host, (err) => {
                            if (err) dialog.showErrorBox(err.message, err.stack)
                        })
                    }, 2000)
                }
            } else if (resp.action == "pushed") {
                // Server -> A
                pushed = true
                pushedInterval === undefined ? 0 : clearInterval(pushedInterval)
                // "5.6.7.8:2333"
                peeraddr_info = resp.data.peeraddr.split(":")
                // B addr:port
                raddr = peeraddr_info[0]
                rport = peeraddr_info[1]

                // A -> NAT A -> NAT B -!> B
                // NAT A will wait for B resp
                const message = Buffer.from(JSON.stringify({ "id": clientIdentity, "action": "knock" }))
                server.send(message, rport, raddr, (err) => {
                    if (err) dialog.showErrorBox(err.message, err.stack)
                })
            } else if (resp.action == "knock") {
                // from peer
                if (!knocked) {
                    // keep alive with peer
                    knockedInterval = setInterval(() => {
                        const alivemessage = Buffer.from(JSON.stringify({ "id": clientIdentity, "action": "alived" }))
                        server.send(alivemessage, rinfo.port, rinfo.address, (err) => {
                            if (err) dialog.showErrorBox(err.message, err.stack)
                        })
                    }, 2000)
                }
                knocked = true
                updateToWindow(`peer knocked: ${msg} from ${rinfo.address}:${rinfo.port}`)
                updateIndicatorToWindow({ status: "connected", id: resp.id })
                const message = Buffer.from(JSON.stringify({ "id": clientIdentity, "action": "answer" }))
                server.send(message, rinfo.port, rinfo.address, (err) => {
                    if (err) dialog.showErrorBox(err.message, err.stack)
                })

                raddr = rinfo.address
                rport = rinfo.port
            } else if (resp.action == "income") {
                // Server -> B
                // A addr:port
                push_id_info = resp.data.peeraddr.split(":")

                // A <- NAT A <- NAT B <- B
                // Cus' NAT A is waiting for B resp
                // so NAT A will forward this resp to A
                // at this point
                // connection between A and B will become active on NAT A
                const message = Buffer.from(JSON.stringify({ "id": clientIdentity, "action": "knock" }))
                updateToWindow(`prepare to connect to ${resp.data.peeraddr}`)
                incomeInterval = setInterval(() => {
                    if (!knocked) {
                        server.send(message, push_id_info[1], push_id_info[0], (err) => {
                            if (err) dialog.showErrorBox(err.message, err.stack)
                        })
                    } else {
                        updateIndicatorToWindow({ status: "connected", id: resp.id })
                    }
                }, 1000)
            } else if (resp.action == "msg") {
                // console.log(`\n-> [${resp.id}]: ${resp.msg}`)
            } else if (resp.action == "answer") {
                knocked = true
                updateToWindow(`peer answered: ${msg} from ${rinfo.address}:${rinfo.port}`)

                setInterval(() => {
                    const alivemessage = Buffer.from(JSON.stringify({ "id": clientIdentity, "action": "alived" }))
                    server.send(alivemessage, rinfo.port, rinfo.address, (err) => {
                        if (err) dialog.showErrorBox(err.message, err.stack)
                    })
                }, 2000)

                raddr = rinfo.address
                rport = rinfo.port
            } else if (resp.action === "alived") {

                let date = new Date()
                // last seen at xxxxx
                window.webContents.send("lastseen", [date.getHours(), date.getMinutes(), date.getSeconds()].join(':'))
                // updateIndicatorToWindow("connected")
                // If A(B) received "disconnect" action,
                // clear all intervals and disconnect the current session
            } else if (resp.action == "disconnect" && raddr === rinfo.address && rport === rinfo.port) {
                clearSession()
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
opusDecoder.on('data', async buf => {
    if (audioOutDevice.deviceInstance !== null) await writeToBuffer(audioOutDevice.deviceInstance, buf)
})

// Opus Encoder
opusEncoder.on('data', buf => {
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
    let retryTimes = 0
    const disconnectMessage = Buffer.from(JSON.stringify({ "id": clientIdentity, "action": "disconnect" }))
    let retryInterval = setInterval(function () {
        retryTimes++
        server.send(disconnectMessage, rinfo.port, rinfo.address, (err) => {
            if (err) dialog.showErrorBox(err.message, err.stack)
        })
        if (retryTimes >= 4) {
            retryTimes = 0
            clearInterval(retryInterval)
        }
    }, 1000)
    updateIndicatorToWindow({ status: "disconnected" })
    clearSession()
})
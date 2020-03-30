// Dependencies
const path = require("path")
const { app, Menu, Tray, BrowserWindow, dialog } = require("electron")
const nativeImage = require("electron").nativeImage

// Audio Support Dependencies
const prism = require("prism-media")
const portAudio = require("naudiodon")

// Global
app.name = "Sobani"

const isMac = process.platform === 'darwin'
const isWin = process.platform === 'win32'
const isLinux = process.platform === 'linux'
// const isFreeBSD = process.platform === 'freebsd'
// const isOpenBSD = process.platform === 'openbsd'

// Preset for Audio properties
let audioOut = undefined
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
    if (device.maxOutputChannels === 0) {
        inputAudioContextMenu.push(audioContextMenuBuilder(device.name, device.id, "in"))
    }

    // Out
    else if (device.maxInputChannels === 0) {
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
        webPreferences: {
            nodeIntegration: true
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

function toggleWindow() {
    window.isVisible() ? window.hide() : window.show()
}

app.on("ready", () => {
    createTray()
    createWindow()
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
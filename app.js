// Dependencies
const path = require("path")
const { app, Menu, Tray, BrowserWindow } = require("electron")
const nativeImage = require("electron").nativeImage

let icon = nativeImage.createFromPath(path.join(__dirname, "src/assets/icon.png"))
let trayIcon = nativeImage.createFromPath(path.join(__dirname, "src/assets/tray.png"))

console.log(trayIcon)

let tray = undefined
let window = undefined

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

    window.on("blur", () => {
        if (!window.webContents.isDevToolsOpened()) {
            window.hide()
        }
    })
}

function createTray() {
    tray = new Tray(trayIcon)
    tray.on("click", () => {
        toggleWindow()
    })

    const contextMenu = Menu.buildFromTemplate([
        {
            label: "Show",
            click: function() {
                toggleWindow()
            }
        },
        {
            label: "Quit",
            click: function () {
                app.quit()
            }
        }
    ])

    tray.setToolTip("Sobani")
    tray.setContextMenu(contextMenu)
}

function toggleWindow() {
    window.isVisible() ? window.hide() : showWindow()
}

function showWindow() {
    const position = getWindowPosition()
    window.setPosition(position.x, position.y, false)
    window.show()
}

function getWindowPosition() {
    const windowBounds = window.getBounds()
    const trayBounds = tray.getBounds()

    const x = Math.round(trayBounds.x + ( trayBounds.width / 2 ) - ( windowBounds.width / 2))
    const y = Math.round(trayBounds.y + trayBounds.height + 4)

    return { x: x, y: y }
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

// Window recreation
app.on("active", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})
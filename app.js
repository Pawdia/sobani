// Dependencies
const path = require("path")
const { app, Menu, Tray, BrowserWindow } = require("electron")
const nativeImage = require("electron").nativeImage

let image = nativeImage.createFromPath(path.join(__dirname, "src/assets/icon.png"))

function createWindow() {
    let window = new BrowserWindow({
        width: 800,
        height: 600,
        backgroundColor: "#FFFFFF",
        icon: path.join(__dirname, "src/assets/icon.png"),
        webPreferences: {
            nodeIntegration: true
        }
    })

    // Set Icon

    window.setIcon(path.join(__dirname, "src/assets/icon.png"))

    // Load start up page
    window.loadFile("index.html")

    // Open DevTools
    window.webContents.openDevTools()
}

function createTray() {
    let tray = new Tray(image)
    const contextMenu = Menu.buildFromTemplate([
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

app.whenReady().then(createWindow).then(createTray)

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
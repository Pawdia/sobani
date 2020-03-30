const { contextBridge, ipcRenderer } = require("electron")
contextBridge.exposeInMainWorld(
    "api", {
        request: (channel, data) => {
            console.log("data is ", data)
            ipcRenderer.send(channel, data)
        },
        response: (channel, func) => {
            console.log("resp")
            ipcRenderer.on(channel, (event, ...args) => {
                func(...args);
            })
        }
    }
)

exports.contextBridge = contextBridge

// Dependencies
const fs = require("fs")
const path = require("path")
const { dialog, shell } = require("electron")

// Local
const Provider = require("./provider/api-provider")
const Global = require("./storage/global")

// Variable
let config = Global.Read("config")
let configPath = Global.Read("configPath")
let appconfigPath = path.resolve(__dirname + "/../config/app.json")

// Function
let quitApp = Global.Read("quitApp")

let control = {
    standard() {
        if (!fs.existsSync(appconfigPath)) {
            let appconfigObject = {
                "development": false,
                "debug": false,
                "provider": []
            }

            fs.writeFileSync(appconfigPath, JSON.stringify(appconfigObject))
            delete require.cache[require.resolve(appconfigPath)]
            let appconfigFatalError = "If this problem still happens, send us issue at https://github.com/Pawdia/sobani"
            dialog.showErrorBox("Fatal Error: App Configuration file corrupted", appconfigFatalError)
            quitApp()
        }
        else {
            appConfig = require(appconfigPath)
            Global.Write("appConfig", appConfig)
            Provider.load()
        }

        if (!fs.existsSync(configPath)) {
            let configObject = {
                "tracker": {
                    "host": "",
                    "port": ""
                }
            }
    
            fs.writeFileSync(configPath, JSON.stringify(configObject))
            delete require.cache[require.resolve("./config.json")]
            let configFatalError = "If this problem still happens, send us issue at https://github.com/Pawdia/sobani"
            config.tracker !== undefined ? tracker = config.tracker : dialog.showErrorBox("Fatal Error: Configuration file corrupted", configFatalError)
            if (!configErrored) {
                shell.openItem(appDataPath)
                configErrored = true
            }
            quitApp()
        }
        else {
            config = require(configPath)
            Global.Write("config", config)
            tracker = {
                host: config.tracker.host,
                port: config.tracker.port
            }
            Global.Add("tracker", tracker)
        }

        if (tracker.host === undefined || tracker.host === "" || tracker.host.trim() === "") {
            let trackerIsNullFatalError = `Configuration not set propertily, please check ${configPath} under application ` +
                "directory to see if you have tracker host and tracker port filled in. If not, find the proper one with sobani-tracker instance"
            dialog.showErrorBox("Tracker configuration is not set", trackerIsNullFatalError)
            if (!configErrored) {
                shell.openItem(appDataPath)
                configErrored = true
            }
            quitApp()
        }
    
        if (parseInt(tracker.port) === NaN || tracker.port === 0 || tracker.port === "" || tracker.port === undefined) {
            let trackerPortIsNaNFatalError = `Configuration not set propertily, please check ${configPath} under application ` +
                "directory to see if you have a valid tracker port filled in. If not, find the proper one with sobani-tracker instance"
            dialog.showErrorBox("Tracker configuration for port is invalid", trackerPortIsNaNFatalError)
            if (!configErrored) {
                shell.openItem(appDataPath)
                configErrored = true
            }
            quitApp()
        }
    
        if (!(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(tracker.host) || /^(?!:\/\/)([a-zA-Z0-9-_]+\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\.[a-zA-Z]{2,11}?$/igm.test(tracker.host))) {
            let trackerHostIsInvalidFatalError = `Configuration not set propertily, please check ${configPath} unser application ` +
                "directory to see if you have a valid tracker host address filled in. Notice that the address starts with 'https://' " +
                "or 'http://' is not required. If not, find the proper one with sobani-tracker instance"
            dialog.showErrorBox("Tracker configuration for host is invalid", trackerHostIsInvalidFatalError)
            if (!configErrored) {
                shell.openItem(appDataPath)
                configErrored = true
            }
            quitApp()
        }

        let bilibili = require("../module/bili")
    },

    debug() {
        this.standard()
    }
}

let debug = {

}

module.exports = control
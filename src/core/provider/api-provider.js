// Dependencies
const url = require('url')
const path = require("path")

// Local
const Log = require("../log")
const Global = require("../storage/global")

// const appConfigPath = Global.Read("appConfig")
// const appConfig = require("../../config/app.json")
const appConfig = Global.Read("appConfig")
let providerConfig = appConfig.provider
let providerMap = {}
let providers = {}

function vulnerabilityWarning(propertyName, valueName, expectedType) {
    let msg = `Incorrect usage of value(s) "${valueName}" found in property "${propertyName}", expected ${expectedType}. ` +
    "If you are seeing this, there might be some unexpected modification to config file, check to make sure " +
    "all the settings are in appropriate value. " + 
    `If you are developing a plugin, you should check your init settings in ${propertyName}.`
    Log.warning(msg)
}

function load() {
    providerMap.api = providerConfig.map(p => {
        if (p.type === "api") {
            return p
        }
    })

    providerMap.sobani = providerConfig.map(p => {
        if (p.type === "sobani") {
            return p
        }
    })

    providerMap.pawdia = providerConfig.map(p => {
        if (p.type === "pawdia") {
            return p
        }
    })

    providerMap.microservice = providerConfig.map(p => {
        if (p.type === "microservice") {
            return p
        }
    })

    providerMap.api.forEach(p => {
        let expectedType = 'string'
        if (typeof p.name === expectedType) {
            let pURL = new URL(p.endpoint.host)
            let pPort = parseInt(p.endpoint.port)

            if (pPort === 0) {
            } else if (pPort === NaN || !( 1 <= pPort && pPort <= 65535 )) {
                vulnerabilityWarning(p.name, p.endpoint.port, "string or int (with in range from 1 to 65535)")
                return 
            } else {
                pURL.port = pPort
            }
            
            pURL.path = p.endpoint.path 
            
            providers[p.name] = pURL.toString()

            Object.defineProperty(providers, p.name, {
                value: {
                    endpoint: pURL.toString(),
                    detail: p
                }
            })
        } else {
            vulnerabilityWarning(p.name, p.name, expectedType)
            return
        }
    })

    providerMap.sobani.forEach(p => {

    })

    providerMap.pawdia.forEach(p => {

    })

    providerMap.microservice.forEach(p => {

    })
}

module.exports = {
    providers,
    load
}
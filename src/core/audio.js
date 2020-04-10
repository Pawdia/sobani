// Audio Support Dependencies
const prism = require("prism-media")
const portAudio = require("naudiodon")

// Preset for Audio properties
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

// Audio Preparation
let inputDevice = {
    started: false,
    deviceInstance: null
}
let outputDevice = {
    started: false,
    deviceInstance: null
}
let deviceOption = {
    channelCount: 1,
    sampleFormat: portAudio.SampleFormat16Bit,
    sampleRate: 48000,
    deviceId: 0,
    closeOnError: false
}

let audioContextMenuOnceToken = false
let audioContextMenu = undefined
function audioContextMenuBuilder(deviceName, deviceId, type) {

    let contextMenuObject = {
        label: `${deviceId}: ${deviceName}`,
        click: function () {
            console.log("Setting up device...")
            switch (type) {
                case "in":
                    if (inputDevice.deviceInstance !== null) {
                        console.log("Switching device...")
                        inputDevice.deviceInstance.quit()
                    }
                    let inOption = deviceOption
                    inOption.deviceId = deviceId
                    inputDevice.deviceInstance = new portAudio.AudioIO({
                        inOptions: inOption
                    })
                    console.log("Input device selected: " + deviceName)
                    inputDevice.started = true
                    inputDevice.deviceInstance.start()
                    inputDevice.deviceInstance.on('data', buf => {
                        opusEncoder.write(buf)
                    })
                    break
                case "out":
                    if (outputDevice.deviceInstance !== null) {
                        console.log("Switching device...")
                        outputDevice.deviceInstance.quit()
                    }
                    let outOption = deviceOption
                    outOption.deviceId = deviceId
                    outputDevice.deviceInstance = new portAudio.AudioIO({
                        outOptions: outOption
                    })
                    console.log("Output device selected: " + deviceName)
                    inputDevice.started = true
                    outputDevice.deviceInstance.start()
                    break
                default:
                    process.exit()
                    break
            }
        }
    }

    return contextMenuObject
}

function getAudioContextMenu(refresh) {
    if (refresh === true) audioContextMenuOnceToken = false

    // `audioContextMenuOnceToken` will be `false` either at the beginning or user requests a refresh
    if (audioContextMenuOnceToken === false) {
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
        audioContextMenu = {
            input:  inputAudioContextMenu,
            output: outputAudioContextMenu
        }
    }
    
    return audioContextMenu
}

module.exports = {
    getAudioContextMenu: getAudioContextMenu,
    inputDevice:  inputDevice,
    outputDevice: outputDevice,
    deviceOption: deviceOption,
    opusEncoder: opusEncoder,
    opusDecoder: opusDecoder,
    quit: () => {
        if (audioInDevice.deviceInstance != null) audioInDevice.deviceInstance.quit()
        if (audioOutDevice.deviceInstance != null) audioOutDevice.deviceInstance.quit()
    }
}

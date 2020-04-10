// Dependencies
const log4js = require("log4js")

let SysTime = new Date()
let logTime = SysTime.getFullYear() + "-" + ("0" + (SysTime.getMonth() + 1)).slice(-2) + "-" + ("0" + SysTime.getDate()).slice(-2)
const coreLogFileName = `../logs/Sobani-${logTime}.log`

log4js.configure({
    appenders: {
        Core: { type: "file", filename: coreLogFileName },
        console: { type: "console" }
    },
    categories: {
        Sobani: { appenders: ["console", "Core"], level: "trace" },
        default: { appenders: ["console"], level: "trace" }
    }
})

let SobaniLogger = log4js.getLogger("Sobani")

function info(log) {
    SobaniLogger.info(log)
}

function trace(log) {
    SobaniLogger.trace(log)
}

function debug(log) {
    SobaniLogger.debug(log)
}

function warning(log) {
    SobaniLogger.warn(log)
}

function fatal(log) {
    SobaniLogger.fatal(log)
}

function level(lev) {
    SobaniLogger.level = lev
}

module.exports = {
    info,
    trace,
    debug,
    warning,
    fatal,
    level
}
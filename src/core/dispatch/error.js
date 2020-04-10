const EventEmit = require("events")

let ErrorType = {
    configFatalError: new Error()
}

class Error extends EventEmit {

}

// class Error {
//     err = new Map()
//     on(event, cb) {
//         if (this.listener[event] === undefined) {
//             this.listener[event] = new Array()
//         }
//         this.listener[event].push(cb)
//     }

//     emit(event, ...arg) {
//         if (this.listener[event] !== undefined) {
//             let listeners = this.listener[event]
//             for (let event_listener of listeners) {
//                 event_listener(...arg)
//             }
//         }
//     }
// }
class audioSession {
    client_id = ""
    constructor(client_id) {
        this.client_id = client_id
    }

    playChunk(chunk) {
        console.log(this.client_id, chunk.length)
    }
}

module.exports = audioSession

import '../assets/css/App.css'
import React, { Component } from 'react'
import { ipcRenderer } from 'electron'

let cry = ">_<"

class App extends Component {
  componentDidMount() {
    console.log("ipcRenderer", window.ipcRenderer)
    alert("Loaded")
    window.ipcRenderer.on("pong", (event, arg) => {
      this.setState({ipc: true})
    })
    window.ipcRenderer.send("ping")
  }
  render() {
    return (
      <div>
        <h1>Hello, this is Sobani</h1>

        <p>WIP to move every UI component here, currently you should try use cli to make more progress.</p>
        <p>Sorry for the inconvinence. {cry}</p>
      </div>
    )
  }
}

export default App

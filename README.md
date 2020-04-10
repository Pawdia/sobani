# sobani
Fully self-hostable and customizable media entertaining stream service based on Node.js for couples, friends, collaboration teams, and even quarantined office workers

## Supported and Tested Platforms
- Linux (App Image) 
Ubuntu 18.04
- macOS
10.15 Cataline
10.14 Mojave
- Windows
Windows 10 1909

## Manual
### First Run
For first run, edit `config.json` for host and port which is the [sobani-tracker](https://github.com/nekomeowww/sobani-tracker)

If you don't find any ways to get an instance, you could use the instance our provided below:

```json
{
  "tracker": {
    "host": "34.80.41.119",
    "port": 3000
  }
}
```

### About config.json
You can build and serve your instance of [sobani-tracker](https://github.com/nekomeowww/sobani-tracker) from source code. For your configuration, set sobani-tracker's host and port in `config.json`, then run it.

### How to use
By connected to the tracker server you have configurated, you will get a share id shown in the window. Copy and send the share id to your friends, you can have only one connect for now.   

After you tell the share id with your friend, click **Connect**, then you will get the connection.   

In the tray icon (status bar icon on macOS), right click and select your input (if you want to send your voice), or output (if you want to listen to your friend's audio). You can select both.   
   
**Don't worry, we won't collect any data you are transferring, we only have your data on sobani-tracker instance to store your IP and NAT port (this project is based on UDP socket), which we don't have your real port.**

If you want to suspend your session with your friends, click **Disconnect** then the session will close.

If you want to change your share id, restart the application is totally fine.

## Known Issues
By using PortAudio, when you use Window as your platform, you may see more selection on **Audio Out** menu, try to use the ones on the top (they usually looks like glitched names, always have some words left to nowhere)

By building this application through the UDP protocol, there might be some strange bugs.


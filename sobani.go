package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"github.com/libp2p/go-libp2p-core/network"
	p2ppeer "github.com/libp2p/go-libp2p-core/peer"
	"github.com/libp2p/go-libp2p-core/peerstore"
	"github.com/multiformats/go-multiaddr"
	"github.com/sirupsen/logrus"
	"os"
)

func handleStream(s network.Stream) {
	logrus.Println("Got a new stream!")

	// Create a buffer stream for non blocking read and write.
	rw := bufio.NewReadWriter(bufio.NewReader(s), bufio.NewWriter(s))

	go readData(rw)
	go writeData(rw)

	// stream 's' will stay open until you close it (or the other side closes it).
}

func readData(rw *bufio.ReadWriter) {
	for {
		str, _ := rw.ReadString('\n')

		if str == "" {
			return
		}
		if str != "\n" {
			// Green console colour: 	\x1b[32m
			// Reset console colour: 	\x1b[0m
			fmt.Printf("\x1b[32m%s\x1b[0m> ", str)
		}
	}
}

func writeData(rw *bufio.ReadWriter) {
	stdReader := bufio.NewReader(os.Stdin)

	for {
		fmt.Print("> ")
		sendData, err := stdReader.ReadString('\n')

		if err != nil {
			panic(err)
		}

		rw.WriteString(fmt.Sprintf("%s\n", sendData))
		rw.Flush()
	}
}

// This function setup the log style and log level
func setupLog(debug *bool) {
	// setup log
	logrus.SetOutput(os.Stdout)
	Formatter := &logrus.TextFormatter{
		EnvironmentOverrideColors: true,
		FullTimestamp:             true,
		TimestampFormat:           "2020-02-27 00:43:00",
	}
	logrus.SetFormatter(Formatter)
	logrus.SetLevel(logrus.InfoLevel)
	if *debug {
		logrus.SetLevel(logrus.DebugLevel)
	}
}

func main() {
	connect := flag.String("connect", "", "Connect to peer by share ID")
	trackerURL := flag.String("tracker", "", "Full tracker URL string")
	debug := flag.Bool("debug", false, "Debug")
	help := flag.Bool("help", false, "Display help")
	flag.Parse()

	if *help {
		fmt.Println("Usage: Run './sobani -tracker <TRACKER_URL>' to announce yourself to tracker.")
		fmt.Println("       Run './sobani -connect <SHARE_ID> -tracker <TRACKER_URL>' to connect to a peer via tracker")
		os.Exit(0)
	}

	setupLog(debug)
	peer, err := newSobaniPeer(trackerURL)
	if err != nil {
		// todo: retry
		panic(err)
	}
	res, err := peer.announceToTracker()
	if err != nil {
		// todo: retry
		panic(err)
	}

	if *connect == "" {
		logrus.Infof("Run './sobani -connect %s -tracker %s' on another console.\n", res.ShareID, *trackerURL)
		// Hang forever
		<-make(chan struct{})
	} else {
		info, err := peer.getPeerInfo(connect)
		if err != nil {
			logrus.Errorf("Cannot get peer `%s` from %s", *connect, peer.TrackerURL)
		} else {
			logrus.Debugln("Peer Info", info)

			// Turn the destination into a multiaddr.
			maddr, err := multiaddr.NewMultiaddr(info.Multiaddr)
			if err != nil {
				logrus.Fatalln(err)
			}

			// Extract the peer ID from the multiaddr.
			p2pinfo, err := p2ppeer.AddrInfoFromP2pAddr(maddr)
			if err != nil {
				logrus.Fatalln(err)
			}

			// Add the destination's peer multiaddress in the peerstore.
			// This will be used during connection and stream creation by libp2p.

			(*peer.Host).Peerstore().AddAddrs(p2pinfo.ID, p2pinfo.Addrs, peerstore.PermanentAddrTTL)

			// Start a stream with the destination.
			// Multiaddress of the destination peer is fetched from the peerstore using 'peerId'.
			s, err := (*peer.Host).NewStream(context.Background(), p2pinfo.ID, "/sobani/1.0.0")
			if err != nil {
				panic(err)
			}

			// Create a buffered stream so that read and writes are non blocking.
			rw := bufio.NewReadWriter(bufio.NewReader(s), bufio.NewWriter(s))

			// Create a thread to read and write data.
			go writeData(rw)
			go readData(rw)

			// Hang forever.
			select {}
		}
	}
}

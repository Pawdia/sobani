package main

import (
	"bufio"
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"flag"
	"fmt"
	"github.com/libp2p/go-libp2p"
	"github.com/libp2p/go-libp2p-core/crypto"
	"github.com/libp2p/go-libp2p-core/network"
	"github.com/multiformats/go-multiaddr"
	log "github.com/sirupsen/logrus"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"strings"
)

type trackerAnnounceRequest struct {
	Ip        string `json:"ip"`
	Port      string `json:"port"`
	Multiaddr string `json:"multiaddr"`
	Action    string `json:"action"`
}

type trackerAnnounceResponse struct {
	ShareId string `json:"shareId"`
}

type trackerPushRequest struct {
	ShareId   string `json:"shareId"`
	Action    string `json:"action"`
}

type trackerPushResponse struct {
	Ip        string `json:"ip"`
	Port      string `json:"port"`
	Multiaddr string `json:"multiaddr"`
}

func handleStream(s network.Stream) {
	log.Println("Got a new stream!")

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

func getPublicIP() (string, error) {
	log.Info("Finding public IP address...")
	res, err := http.Get("http://ip.cip.cc/")
	if err != nil {
		log.Fatal(err)
		return "", err
	}
	defer res.Body.Close()

	if res.Status != "200 OK" {
		log.Fatal(err)
		return "", err
	}

	body, _ := ioutil.ReadAll(res.Body)
	return strings.TrimSpace(string(body)), nil
}

func announceToTracker(trackerUrl *string, request *trackerAnnounceRequest) *trackerAnnounceResponse {
	log.Info("Announcing to tracker at: %s", *trackerUrl)

	requestJson, _ := json.Marshal(request)
	log.Debug("JSON: ", string(requestJson))
	req, err := http.NewRequest("POST", *trackerUrl, bytes.NewBuffer(requestJson))
	req.Header.Set("Content-Type", "application/json;charset=utf-8")
	if err != nil {
		log.Fatal(err)
	}
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Error(err)
	}

	if resp.Status != "200 OK" {
		log.Error("Tracker error")
	}

	body, _ := ioutil.ReadAll(resp.Body)
	log.Debug("response Body:", string(body))

	res := trackerAnnounceResponse{}
	json.Unmarshal(body, &res)
	return &res
}

func getPeerInfo(request *trackerPushRequest, trackerUrl *string) {
	log.Infof("Connecting to %s via %s", (*request).ShareId, *trackerUrl)
}

func main() {
	connect := flag.String("connect", "", "Connect to peer by share ID")
	trackerUrl := flag.String("tracker", "", "Full tracker URL string")
	help := flag.Bool("help", false, "Display help")
	flag.Parse()

	if *help {
		fmt.Println("Usage: Run './chat -tracker <TRACKER_URL>' to announce yourself to tracker.")
		fmt.Println("       Run './chat -connect <SHARE_ID> -tracker <TRACKER_URL>' to connect to a peer via tracker")
		os.Exit(0)
	}

	log.SetOutput(os.Stdout)
	Formatter := &log.TextFormatter{
		EnvironmentOverrideColors: true,
		FullTimestamp:             true,
		TimestampFormat:           "2020-02-27 00:43:00",
	}
	log.SetFormatter(Formatter)
	log.SetLevel(log.DebugLevel)

	// If debug is enabled, use a constant random source to generate the peer ID. Only useful for debugging,
	// off by default. Otherwise, it uses rand.Reader.
	var r io.Reader = rand.Reader

	// Creates a new RSA key pair for this host.
	prvKey, _, err := crypto.GenerateKeyPairWithReader(crypto.RSA, 2048, r)
	if err != nil {
		panic(err)
	}

	// 0.0.0.0 will listen on any interface device.
	sourceMultiAddr, _ := multiaddr.NewMultiaddr("/ip4/0.0.0.0/tcp/0")

	// libp2p.New constructs a new libp2p Host.
	// Other options can be added here.
	host, err := libp2p.New(
		context.Background(),
		libp2p.ListenAddrs(sourceMultiAddr),
		libp2p.Identity(prvKey),
	)

	if err != nil {
		panic(err)
	}

	if *connect == "" {
		// Set a function as stream handler.
		// This function is called when a peer connects, and starts a stream with this protocol.
		// Only applies on the receiving side.
		host.SetStreamHandler("/chat/1.0.0", handleStream)

		// Let's get the actual TCP port from our listen multiaddr, in case we're using 0 (default; random available port).
		var port string
		for _, la := range host.Network().ListenAddresses() {
			if p, err := la.ValueForProtocol(multiaddr.P_TCP); err == nil {
				port = p
				break
			}
		}

		if port == "" {
			panic("was not able to find actual local port")
		}

		publicIp, err := getPublicIP()
		if err != nil {
			log.Debug(err)
		}
		request := &trackerAnnounceRequest{
			Ip:        publicIp,
			Port:      port,
			Multiaddr: host.ID().Pretty(),
			Action:    "announce",
		}
		res := announceToTracker(trackerUrl, request)
		log.Info("Run './chat -connect %s -tracker %s' on another console.\n", res.ShareId, trackerUrl)

		// Hang forever
		<-make(chan struct{})
	} else {
		log.Debug("This node's multiaddresses:")
		for _, la := range host.Addrs() {
			log.Debug(" - %v\n", la)
		}

		request := &trackerPushRequest {
			ShareId: *connect,
			Action: "push"
		}
		getPeerInfo(request, trackerUrl)

		//// Turn the destination into a multiaddr.
		//maddr, err := multiaddr.NewMultiaddr(*dest)
		//if err != nil {
		//	log.Fatalln(err)
		//}
		//
		//// Extract the peer ID from the multiaddr.
		//info, err := peer.AddrInfoFromP2pAddr(maddr)
		//if err != nil {
		//	log.Fatalln(err)
		//}
		//
		//// Add the destination's peer multiaddress in the peerstore.
		//// This will be used during connection and stream creation by libp2p.
		//host.Peerstore().AddAddrs(info.ID, info.Addrs, peerstore.PermanentAddrTTL)
		//
		//// Start a stream with the destination.
		//// Multiaddress of the destination peer is fetched from the peerstore using 'peerId'.
		//s, err := host.NewStream(context.Background(), info.ID, "/chat/1.0.0")
		//if err != nil {
		//	panic(err)
		//}
		//
		//// Create a buffered stream so that read and writes are non blocking.
		//rw := bufio.NewReadWriter(bufio.NewReader(s), bufio.NewWriter(s))
		//
		//// Create a thread to read and write data.
		//go writeData(rw)
		//go readData(rw)
		//
		//// Hang forever.
		//select {}
	}
}

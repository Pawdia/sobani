package main

import (
	"encoding/json"
	"flag"
	"fmt"
	log "github.com/sirupsen/logrus"
	"net"
	"os"
	"time"
)

//	{
//      "action": "pulse",
//		"override": true,
//		"shareId": "73756b69"
//	}
type trackerPulseRequest struct {
	Action   string `json:"action"`
	Override bool   `json:"override,omitempty"`
	ShareID  string `json:"shareId,omitempty"`
}

//	{
//		"action": "announce"
//	}
type trackerAnnounceRequest struct {
	Action string `json:"action"`
}

//	{
//		"action": "push"
//		"shareId": "6e656b6f",
//	}
type trackerPushRequest struct {
	Action  string `json:"action"`
	ShareID string `json:"shareId"`
}

//	{
//		"action": "announceReceived",
//      "data": {
//      }
//	}
type trackerResponse struct {
	Action string            `json:"action"`
	Data   map[string]string `json:"data"`
}

func keepalive(conn *net.UDPConn, saddr *net.UDPAddr, seconds time.Duration) {
	for {
		pulseRequest := trackerPulseRequest{
			"pulse",
			false,
			"",
		}
		jsonRequest, err := json.Marshal(pulseRequest)
		_, err = conn.WriteToUDP(jsonRequest, saddr)
		if err != nil {
			log.Fatal(err)
		}
		time.Sleep(seconds * time.Second)
	}
}

func listenServerResponse(conn *net.UDPConn) {
	buf := make([]byte, 2048)
	for {
		var anyResponse trackerResponse
		fmt.Println("go read")
		n, _, err := conn.ReadFromUDP(buf)
		fmt.Println("did read")
		if err != nil {
			log.Print("Get peer address from server failed.")
			log.Fatal(err)
		}
		err = json.Unmarshal(buf[:n], &anyResponse)
		if err != nil {
			log.Print("Unmarshal server response failed.")
			log.Fatal(err)
		}
		fmt.Println(anyResponse)
	}
}

// This function setup the log style and log level
func setupLog(debug *bool) {
	// setup log
	log.SetOutput(os.Stdout)
	Formatter := &log.TextFormatter{
		EnvironmentOverrideColors: true,
		FullTimestamp:             true,
		TimestampFormat:           "2020-02-28 00:43:00",
	}
	log.SetFormatter(Formatter)
	log.SetLevel(log.InfoLevel)
	if *debug {
		log.SetLevel(log.DebugLevel)
	}
}

func main() {
	connect := flag.String("connect", "", "Connect to peer by share ID")
	trackerURL := flag.String("tracker", "", "Full tracker URL string")
	port := flag.String("port", "", "Local port")
	debug := flag.Bool("debug", false, "Debug")
	help := flag.Bool("help", false, "Display help")
	flag.Parse()

	if *help {
		fmt.Println("Usage: Run './sobani -tracker <TRACKER_URL>' to announce yourself to tracker.")
		fmt.Println("       Run './sobani -connect <SHARE_ID> -tracker <TRACKER_URL>' to connect to a peer via tracker")
		os.Exit(0)
	}

	setupLog(debug)
	buf := make([]byte, 2048)

	// Prepare to register user to server.
	saddr, err := net.ResolveUDPAddr("udp4", *trackerURL)
	if err != nil {
		log.Print("Resolve server address failed.")
		log.Fatal(err)
	}

	// Prepare for local listening.
	addr, err := net.ResolveUDPAddr("udp4", *port)
	if err != nil {
		log.Print("Resolve local address failed.")
		log.Fatal(err)
	}
	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		log.Print("Listen UDP failed.")
		log.Fatal(err)
	}

	// Send registration information to server.
	announceRequest := trackerAnnounceRequest{
		"announce",
	}
	jsonRequest, err := json.Marshal(announceRequest)
	if err != nil {
		log.Print("Marshal Register information failed.")
		log.Fatal(err)
	}
	_, err = conn.WriteToUDP(jsonRequest, saddr)
	if err != nil {
		log.Fatal(err)
	}

	log.Print("Waiting for server response...")

	n, _, err := conn.ReadFromUDP(buf)
	if err != nil {
		log.Print("Register to server failed.")
		log.Fatal(err)
	}
	var announceResponse trackerResponse
	err = json.Unmarshal(buf[:n], &announceResponse)
	if err != nil {
		log.Print("Unmarshal server response failed.")
		log.Fatal(err)
	}
	var shareID = announceResponse.Data["shareId"]
	fmt.Printf("./client -tracker %s -connect %s\n", *trackerURL, shareID)

	go keepalive(conn, saddr, 30)
	go listenServerResponse(conn)

	if *connect == "" {
		<-make(chan struct{})
	} else {
		// Send connect request to server
		pushRequest := trackerPushRequest{
			"push",
			*connect,
		}
		jsonRequest, err = json.Marshal(pushRequest)
		if err != nil {
			log.Print("Marshal connection information failed.")
			log.Fatal(err)
		}

		for {
			conn.WriteToUDP(jsonRequest, saddr)
			time.Sleep(10 * time.Second)
		}
	}
}

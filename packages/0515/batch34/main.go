package main

import (
	"bufio"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"golang.org/x/net/icmp"
	"golang.org/x/net/ipv4"
)

type HealthResult struct {
	Host          string
	PacketsSent   int
	PacketsRecv   int
	AvgRTT       time.Duration
	TCPOk         bool
	TCPPort       int
	TCPLatency    time.Duration
	HTTPOk        bool
	HTTPStatus    int
	HTTPLatency   time.Duration
	HealthScore   float64
}

type PacketConn interface {
	WriteTo(b []byte, addr net.Addr) (int, error)
	ReadFrom(b []byte) (int, net.Addr, error)
	SetDeadline(t time.Time) error
	Close() error
}

var (
	newICMPConn = func(network, address string) (PacketConn, error) {
		return icmp.ListenPacket(network, address)
	}
	resolveIPAddr = func(network, host string) (*net.IPAddr, error) {
		return net.ResolveIPAddr(network, host)
	}
	getPID = func() int {
		return os.Getpid()
	}
)

func buildICMPEcho(id, seq int, data []byte) ([]byte, error) {
	msg := icmp.Message{
		Type: ipv4.ICMPTypeEcho,
		Code: 0,
		Body: &icmp.Echo{
			ID:   id,
			Seq:  seq,
			Data: data,
		},
	}
	return msg.Marshal(nil)
}

func parseICMPReply(data []byte) (*icmp.Message, error) {
	return icmp.ParseMessage(1, data)
}

func isEchoReply(msg *icmp.Message) bool {
	return msg.Type == ipv4.ICMPTypeEchoReply
}

func resolveHost(host string) (string, error) {
	ipAddr, err := resolveIPAddr("ip4", host)
	if err != nil {
		return "", err
	}
	return ipAddr.String(), nil
}

func readHosts(filename string) ([]string, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var hosts []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		host := strings.TrimSpace(scanner.Text())
		if host != "" && !strings.HasPrefix(host, "#") {
			hosts = append(hosts, host)
		}
	}
	return hosts, scanner.Err()
}

func ping(host string, count int, timeout time.Duration) (sent, recv int, avgRTT time.Duration, err error) {
	conn, err := icmp.ListenPacket("udp4", "0.0.0.0")
	if err != nil {
		return 0, 0, 0, err
	}
	defer conn.Close()

	ipAddr, err := net.ResolveIPAddr("ip4", host)
	if err != nil {
		return 0, 0, 0, err
	}

	var totalRTT time.Duration
	var mu sync.Mutex

	for i := 0; i < count; i++ {
		msg := icmp.Message{
			Type: ipv4.ICMPTypeEcho, Code: 0,
			Body: &icmp.Echo{
				ID:   os.Getpid() & 0xffff,
				Seq:  i + 1,
				Data: []byte("HELLO-R-U-THERE"),
			},
		}

		msgBytes, err := msg.Marshal(nil)
		if err != nil {
			continue
		}

		start := time.Now()
		sent++

		conn.SetDeadline(time.Now().Add(timeout))

		_, err = conn.WriteTo(msgBytes, &net.UDPAddr{IP: ipAddr.IP})
		if err != nil {
			continue
		}

		rb := make([]byte, 1500)
		n, _, err := conn.ReadFrom(rb)
		if err != nil {
			continue
		}

		rtt := time.Since(start)
		if rtt < 0 {
			continue
		}
		rm, err := icmp.ParseMessage(1, rb[:n])
		if err != nil {
			continue
		}

		switch rm.Type {
		case ipv4.ICMPTypeEchoReply:
			mu.Lock()
			recv++
			totalRTT += rtt
			mu.Unlock()
		}
	}

	if recv > 0 {
		avgRTT = totalRTT / time.Duration(recv)
	}

	return sent, recv, avgRTT, nil
}

func tcpCheck(host string, port int, timeout time.Duration) (bool, time.Duration) {
	addr := fmt.Sprintf("%s:%d", host, port)
	start := time.Now()
	conn, err := net.DialTimeout("tcp", addr, timeout)
	if err != nil {
		return false, 0
	}
	defer conn.Close()
	latency := time.Since(start)
	return true, latency
}

func httpCheck(host string, timeout time.Duration) (bool, int, time.Duration) {
	url := fmt.Sprintf("http://%s", host)
	start := time.Now()
	client := &http.Client{
		Timeout: timeout,
	}
	resp, err := client.Get(url)
	if err != nil {
		return false, 0, 0
	}
	defer resp.Body.Close()
	latency := time.Since(start)
	return true, resp.StatusCode, latency
}

func calculateHealthScore(result *HealthResult) float64 {
	score := 0.0
	weightCount := 0

	if result.PacketsSent > 0 {
		pingSuccess := float64(result.PacketsRecv) / float64(result.PacketsSent)
		score += pingSuccess * 30
		weightCount += 30
	}

	if result.TCPPort > 0 {
		if result.TCPOk {
			score += 30
		}
		weightCount += 30
	}

	if result.HTTPOk {
		if result.HTTPStatus >= 200 && result.HTTPStatus < 300 {
			score += 40
		} else if result.HTTPStatus >= 300 && result.HTTPStatus < 400 {
			score += 30
		} else if result.HTTPStatus >= 400 && result.HTTPStatus < 500 {
			score += 20
		} else {
			score += 10
		}
		weightCount += 40
	}

	if weightCount > 0 {
		return score / float64(weightCount) * 100
	}
	return score
}

func getHealthColor(score float64) string {
	if score >= 80 {
		return "OK"
	} else if score >= 50 {
		return "WARN"
	}
	return "FAIL"
}

func main() {
	hostsFile := flag.String("f", "", "File containing list of hosts (one per line)")
	count := flag.Int("c", 4, "Number of ping packets to send")
	timeout := flag.Duration("t", 2*time.Second, "Timeout per check")
	concurrency := flag.Int("n", 10, "Maximum concurrent checks")
	port := flag.Int("port", 0, "TCP port to check (e.g., 80, 443)")
	httpCheckFlag := flag.Bool("http", false, "Enable HTTP status code check")
	flag.Parse()

	if *hostsFile == "" {
		fmt.Println("Usage: pingbatch -f <hosts_file> [options]")
		flag.PrintDefaults()
		os.Exit(1)
	}

	hosts, err := readHosts(*hostsFile)
	if err != nil {
		fmt.Printf("Error reading hosts file: %v\n", err)
		os.Exit(1)
	}

	if len(hosts) == 0 {
		fmt.Println("No hosts found in the file")
		os.Exit(1)
	}

	fmt.Printf("Starting health check: %d hosts, %d ping packets, %v timeout, %d concurrency\n",
		len(hosts), *count, *timeout, *concurrency)
	if *port > 0 {
		fmt.Printf("  + TCP port check: port %d\n", *port)
	}
	if *httpCheckFlag {
		fmt.Printf("  + HTTP status check enabled\n")
	}
	fmt.Println()

	semaphore := make(chan struct{}, *concurrency)
	var wg sync.WaitGroup
	results := make(chan *HealthResult, len(hosts))

	for _, host := range hosts {
		wg.Add(1)
		go func(h string) {
			defer func() {
				if r := recover(); r != nil {
					fmt.Printf("Panic recovered while checking %s: %v\n", h, r)
				}
				wg.Done()
			}()
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			result := &HealthResult{Host: h}

			sent, recv, avgRTT, err := ping(h, *count, *timeout)
			if err != nil {
				fmt.Printf("Ping error for %s: %v\n", h, err)
			}
			result.PacketsSent = sent
			result.PacketsRecv = recv
			result.AvgRTT = avgRTT

			if *port > 0 {
				result.TCPPort = *port
				result.TCPOk, result.TCPLatency = tcpCheck(h, *port, *timeout)
			}

			if *httpCheckFlag {
				result.HTTPOk, result.HTTPStatus, result.HTTPLatency = httpCheck(h, *timeout)
			}

			result.HealthScore = calculateHealthScore(result)

			results <- result
		}(host)
	}

	wg.Wait()
	close(results)

	fmt.Println(strings.Repeat("=", 120))
	header := fmt.Sprintf("%-30s %-15s %-15s", "HOST", "PING LOSS", "PING RTT")
	if *port > 0 {
		header += fmt.Sprintf(" %-12s", "TCP")
	}
	if *httpCheckFlag {
		header += fmt.Sprintf(" %-12s", "HTTP")
	}
	header += fmt.Sprintf(" %-10s", "SCORE")
	fmt.Println(header)
	fmt.Println(strings.Repeat("-", 120))

	for result := range results {
		pingLoss := 0.0
		if result.PacketsSent > 0 {
			pingLoss = float64(result.PacketsSent-result.PacketsRecv) / float64(result.PacketsSent) * 100
		}

		line := fmt.Sprintf("%-30s %6.1f%%        %-15v",
			result.Host, pingLoss, result.AvgRTT)

		if *port > 0 {
			if result.TCPOk {
				line += fmt.Sprintf(" OK %-8v", result.TCPLatency)
			} else {
				line += " FAIL        "
			}
		}

		if *httpCheckFlag {
			if result.HTTPOk {
				line += fmt.Sprintf(" %d %-7v", result.HTTPStatus, result.HTTPLatency)
			} else {
				line += " FAIL        "
			}
		}

		line += fmt.Sprintf(" %5.1f%% %s", result.HealthScore, getHealthColor(result.HealthScore))

		fmt.Println(line)
	}

	fmt.Println(strings.Repeat("=", 120))
}

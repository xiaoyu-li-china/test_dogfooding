package main

import (
	"bytes"
	"net"
	"os"
	"testing"
	"time"

	"golang.org/x/net/icmp"
	"golang.org/x/net/ipv4"
)

func TestBuildICMPEcho(t *testing.T) {
	tests := []struct {
		name   string
		id     int
		seq    int
		data   []byte
	}{
		{
			name: "basic echo packet",
			id:   1234,
			seq:  1,
			data: []byte("HELLO-R-U-THERE"),
		},
		{
			name: "empty data",
			id:   5678,
			seq:  100,
			data: []byte{},
		},
		{
			name: "large data",
			id:   0xffff,
			seq:  0xffff,
			data: bytes.Repeat([]byte("X"), 100),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			packet, err := buildICMPEcho(tt.id, tt.seq, tt.data)
			if err != nil {
				t.Fatalf("buildICMPEcho() error = %v", err)
			}

			if len(packet) == 0 {
				t.Error("buildICMPEcho() returned empty packet")
			}

			msg, err := icmp.ParseMessage(1, packet)
			if err != nil {
				t.Fatalf("Failed to parse built packet: %v", err)
			}

			if msg.Type != ipv4.ICMPTypeEcho {
				t.Errorf("Expected type Echo, got %v", msg.Type)
			}

			echo, ok := msg.Body.(*icmp.Echo)
			if !ok {
				t.Fatal("Body is not *icmp.Echo")
			}

			if echo.ID != tt.id {
				t.Errorf("Expected ID %d, got %d", tt.id, echo.ID)
			}

			if echo.Seq != tt.seq {
				t.Errorf("Expected Seq %d, got %d", tt.seq, echo.Seq)
			}

			if !bytes.Equal(echo.Data, tt.data) {
				t.Errorf("Expected data %v, got %v", tt.data, echo.Data)
			}
		})
	}
}

func TestParseICMPReply(t *testing.T) {
	originalMsg := icmp.Message{
		Type: ipv4.ICMPTypeEchoReply,
		Code: 0,
		Body: &icmp.Echo{
			ID:   1234,
			Seq:  1,
			Data: []byte("test data"),
		},
	}

	packet, err := originalMsg.Marshal(nil)
	if err != nil {
		t.Fatalf("Failed to marshal test message: %v", err)
	}

	parsedMsg, err := parseICMPReply(packet)
	if err != nil {
		t.Fatalf("parseICMPReply() error = %v", err)
	}

	if parsedMsg.Type != ipv4.ICMPTypeEchoReply {
		t.Errorf("Expected type EchoReply, got %v", parsedMsg.Type)
	}

	echo, ok := parsedMsg.Body.(*icmp.Echo)
	if !ok {
		t.Fatal("Body is not *icmp.Echo")
	}

	if echo.ID != 1234 {
		t.Errorf("Expected ID 1234, got %d", echo.ID)
	}

	if echo.Seq != 1 {
		t.Errorf("Expected Seq 1, got %d", echo.Seq)
	}

	if !bytes.Equal(echo.Data, []byte("test data")) {
		t.Errorf("Expected data mismatch")
	}
}

func TestParseICMPReply_InvalidData(t *testing.T) {
	_, err := parseICMPReply([]byte{})
	if err == nil {
		t.Error("Expected error for empty packet, got nil")
	}
}

func TestIsEchoReply(t *testing.T) {
	tests := []struct {
		name     string
		msgType  ipv4.ICMPType
		expected bool
	}{
		{
			name:     "echo reply",
			msgType:  ipv4.ICMPTypeEchoReply,
			expected: true,
		},
		{
			name:     "echo request",
			msgType:  ipv4.ICMPTypeEcho,
			expected: false,
		},
		{
			name:     "destination unreachable",
			msgType:  ipv4.ICMPTypeDestinationUnreachable,
			expected: false,
		},
		{
			name:     "time exceeded",
			msgType:  ipv4.ICMPTypeTimeExceeded,
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			msg := &icmp.Message{
				Type: tt.msgType,
				Code: 0,
				Body: &icmp.Echo{},
			}
			result := isEchoReply(msg)
			if result != tt.expected {
				t.Errorf("isEchoReply() = %v, expected %v", result, tt.expected)
			}
		})
	}
}

func TestResolveHost(t *testing.T) {
	originalResolveIPAddr := resolveIPAddr
	defer func() { resolveIPAddr = originalResolveIPAddr }()

	tests := []struct {
		name          string
		host          string
		mockResult    *net.IPAddr
		mockError     error
		expectedIP    string
		expectError   bool
	}{
		{
			name: "valid ip address",
			host: "8.8.8.8",
			mockResult: &net.IPAddr{
				IP: net.ParseIP("8.8.8.8"),
			},
			expectedIP:  "8.8.8.8",
			expectError: false,
		},
		{
			name:        "invalid host",
			host:        "invalid-host-12345",
			mockError:   &net.DNSError{Err: "no such host"},
			expectError: true,
		},
		{
			name: "localhost",
			host: "localhost",
			mockResult: &net.IPAddr{
				IP: net.ParseIP("127.0.0.1"),
			},
			expectedIP:  "127.0.0.1",
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resolveIPAddr = func(network, host string) (*net.IPAddr, error) {
				return tt.mockResult, tt.mockError
			}

			result, err := resolveHost(tt.host)
			if tt.expectError {
				if err == nil {
					t.Error("Expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Fatalf("resolveHost() error = %v", err)
			}

			if result != tt.expectedIP {
				t.Errorf("resolveHost() = %v, expected %v", result, tt.expectedIP)
			}
		})
	}
}

type mockPacketConn struct {
	writeToFunc  func(b []byte, addr net.Addr) (int, error)
	readFromFunc func(b []byte) (int, net.Addr, error)
	setDeadlineFunc func(t time.Time) error
	closeFunc    func() error
}

func (m *mockPacketConn) WriteTo(b []byte, addr net.Addr) (int, error) {
	if m.writeToFunc != nil {
		return m.writeToFunc(b, addr)
	}
	return len(b), nil
}

func (m *mockPacketConn) ReadFrom(b []byte) (int, net.Addr, error) {
	if m.readFromFunc != nil {
		return m.readFromFunc(b)
	}
	return 0, nil, nil
}

func (m *mockPacketConn) SetDeadline(t time.Time) error {
	if m.setDeadlineFunc != nil {
		return m.setDeadlineFunc(t)
	}
	return nil
}

func (m *mockPacketConn) Close() error {
	if m.closeFunc != nil {
		return m.closeFunc()
	}
	return nil
}

func TestReadHosts(t *testing.T) {
	tmpfile, err := os.CreateTemp("", "hosts")
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(tmpfile.Name())

	content := `# Comment line
8.8.8.8
1.1.1.1

google.com
# another comment
baidu.com
`
	if _, err := tmpfile.WriteString(content); err != nil {
		t.Fatal(err)
	}
	if err := tmpfile.Close(); err != nil {
		t.Fatal(err)
	}

	hosts, err := readHosts(tmpfile.Name())
	if err != nil {
		t.Fatalf("readHosts() error = %v", err)
	}

	expected := []string{"8.8.8.8", "1.1.1.1", "google.com", "baidu.com"}
	if len(hosts) != len(expected) {
		t.Errorf("Expected %d hosts, got %d", len(expected), len(hosts))
	}

	for i, host := range expected {
		if hosts[i] != host {
			t.Errorf("hosts[%d] = %s, expected %s", i, hosts[i], host)
		}
	}
}

func TestReadHosts_FileNotFound(t *testing.T) {
	_, err := readHosts("nonexistent-file-12345.txt")
	if err == nil {
		t.Error("Expected error for non-existent file, got nil")
	}
}

func TestCalculateHealthScore(t *testing.T) {
	tests := []struct {
		name     string
		result   *HealthResult
		expected float64
	}{
		{
			name: "perfect health",
			result: &HealthResult{
				PacketsSent: 4,
				PacketsRecv: 4,
				TCPPort:     80,
				TCPOk:        true,
				HTTPOk:       true,
				HTTPStatus:   200,
			},
			expected: 100.0,
		},
		{
			name: "50% packet loss",
			result: &HealthResult{
				PacketsSent: 4,
				PacketsRecv: 2,
			},
			expected: 50.0,
		},
		{
			name: "tcp only failed",
			result: &HealthResult{
				PacketsSent: 4,
				PacketsRecv: 4,
				TCPPort:     80,
				TCPOk:        false,
			},
			expected: 50.0,
		},
		{
			name: "http 500 error",
			result: &HealthResult{
				PacketsSent: 4,
				PacketsRecv: 4,
				TCPPort:     80,
				TCPOk:        true,
				HTTPOk:       true,
				HTTPStatus:   500,
			},
			expected: 70.0,
		},
		{
			name: "http 404 error",
			result: &HealthResult{
				PacketsSent: 4,
				PacketsRecv: 4,
				TCPPort:     80,
				TCPOk:        true,
				HTTPOk:       true,
				HTTPStatus:   404,
			},
			expected: 80.0,
		},
		{
			name: "http redirect",
			result: &HealthResult{
				PacketsSent: 4,
				PacketsRecv: 4,
				TCPPort:     80,
				TCPOk:        true,
				HTTPOk:       true,
				HTTPStatus:   301,
			},
			expected: 90.0,
		},
		{
			name: "no checks",
			result: &HealthResult{
				PacketsSent: 0,
			},
			expected: 0.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			score := calculateHealthScore(tt.result)
			diff := score - tt.expected
			if diff < 0 {
				diff = -diff
			}
			if diff > 0.1 {
				t.Errorf("calculateHealthScore() = %.1f, expected %.1f", score, tt.expected)
			}
		})
	}
}

func TestGetHealthColor(t *testing.T) {
	tests := []struct {
		name     string
		score    float64
		expected string
	}{
		{
			name:     "perfect score",
			score:    100.0,
			expected: "OK",
		},
		{
			name:     "just ok threshold",
			score:    80.0,
			expected: "OK",
		},
		{
			name:     "warn threshold",
			score:    79.9,
			expected: "WARN",
		},
		{
			name:     "mid warn",
			score:    60.0,
			expected: "WARN",
		},
		{
			name:     "fail threshold",
			score:    49.9,
			expected: "FAIL",
		},
		{
			name:     "zero score",
			score:    0.0,
			expected: "FAIL",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getHealthColor(tt.score)
			if result != tt.expected {
				t.Errorf("getHealthColor(%.1f) = %s, expected %s", tt.score, result, tt.expected)
			}
		})
	}
}

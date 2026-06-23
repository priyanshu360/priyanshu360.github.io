## How to Build a BitTorrent Client in Go

In this tutorial, you'll build a full-featured BitTorrent client in Go. It downloads files from the BitTorrent network using rarest-first piece selection, 16 KB block pipelining, and SHA-1 hash verification. It discovers peers via HTTP trackers, UDP trackers (BEP 15), and a Kademlia DHT (BEP 5) with SQLite persistence. It supports magnet links, multi-file torrents, PEX peer exchange (BEP 10), UPnP port forwarding, and has a TUI built with Bubble Tea.

### What you'll learn

- Parsing `.torrent` bencoded metainfo files with multi-file support
- The BitTorrent peer wire protocol: handshake, messages, keep-alive
- Rarest-first piece selection with block pipelining (up to 10 concurrent requests)
- SHA-1 hash verification with retry on mismatch
- Connecting to HTTP and UDP trackers (BEP 15) for peer discovery
- Building a Kademlia DHT (BEP 5) with KRPC query routing and SQLite persistence
- Parsing magnet URIs (xt, dn, tr, ws)
- Managing peer connections with exponential backoff for retries
- Peer Exchange (PEX) via the extension protocol (BEP 10)
- UPnP IGD port forwarding for incoming connections
- Building a terminal UI with Bubble Tea for input and download progress
- Structured error handling with typed error codes and recovery suggestions

### Prerequisites

- Go 1.21+
- Basic knowledge of TCP and UDP networking
- A `.torrent` file or magnet link for testing
- A router with UPnP support (optional, for port forwarding)

### Project structure

```
torrent-client/
├── cmd/
│   └── torrent-client/
│       └── main.go                      # Entry point: CLI flags, orchestration
├── internal/
│   └── logger/
│       └── logger.go                    # Structured logging (JSON/text, file output)
├── pkg/
│   ├── client/
│   │   ├── client.go                    # Client: peer mgmt, rarest-first, pipelining
│   │   └── protocol.go                  # Wire protocol: handshake, messages, SHA-1
│   ├── config/
│   │   ├── config.go                    # Config struct, JSON file load/save, validation
│   │   └── config_test.go
│   ├── dht/
│   │   ├── node.go                      # Kademlia node: bootstrap, lookup, get_peers
│   │   ├── routing.go                   # Routing table: k-buckets, split, closest nodes
│   │   ├── krpc.go                      # KRPC protocol: encode/decode queries & responses
│   │   ├── store.go                     # SQLite persistence for routing table
│   │   ├── discovery.go                 # DHT as a PeerSource (PeerSource interface)
│   │   ├── types.go                     # nodeInfo, peerAddr types
│   │   └── node_test.go, routing_test.go, krpc_test.go
│   ├── discovery/
│   │   ├── discovery.go                 # PeerSource interface, fan-out dedup
│   │   ├── tracker.go                   # HTTP tracker client
│   │   ├── udp_tracker.go               # UDP tracker client (BEP 15)
│   │   └── tracker_test.go
│   ├── errors/
│   │   └── errors.go                    # Structured error types with recovery hints
│   ├── magnet/
│   │   ├── magnet.go                    # Magnet URI parser (BEP 9)
│   │   └── magnet_test.go
│   ├── peers/
│   │   ├── peers.go                     # Peer type, compact format unmarshal
│   │   ├── connection.go                # PeerConnection state machine, PeerManager
│   │   └── connection_test.go
│   ├── pex/
│   │   └── pex.go                       # PEX (BEP 10): extension handshake, marshal
│   ├── storage/
│   │   ├── storage.go                   # Multi-file storage with global offset routing
│   │   └── storage_test.go
│   ├── torrentFile/
│   │   ├── torrentFile.go               # .torrent file parser (bencode, info hash)
│   │   ├── tracker.go                   # Legacy tracker request helper, default trackers
│   │   └── torrentFile_test.go, e2e_test.go
│   └── upnp/
│       └── upnp.go                      # UPnP IGD: discover, add, remove port mappings
├── tui/
│   ├── tui.go                           # Bubble Tea input form: file, magnet, settings
│   ├── download.go                      # Bubble Tea download progress view
│   └── completer.go                     # Tab-completion for file paths
├── go.mod
├── go.sum
├── README.md
├── CHANGELOG.md
└── LICENSE
```

### Package dependencies

| Package | Why |
|---------|-----|
| `github.com/jackpal/bencode-go` | Bencode parsing for `.torrent` files, tracker responses, and DHT KRPC messages |
| `github.com/charmbracelet/bubbletea` | Terminal UI framework — input forms and download progress |
| `github.com/charmbracelet/bubbles` | Bubble Tea widgets (textinput) |
| `github.com/huin/goupnp` | UPnP IGD discovery and port mapping (WANIPConnection, WANPPPConnection) |
| `modernc.org/sqlite` | Pure-Go SQLite for DHT routing table persistence — no CGo |
| `github.com/stretchr/testify` | Test assertions |
| `golang.org/x/sync` | Async primitives for concurrent peer handling |

**Why these choices?**

- **jackpal/bencode-go over a custom parser**: Writing a robust bencode parser is a fun exercise, but the torrent file format has edge cases. The jackpal library is battle-tested. The DHT KRPC module does do its own manual bencode parsing (in `krpc.go`) to handle partial messages efficiently without full unmarshal — a pragmatic hybrid approach.

- **SQLite (modernc.org/sqlite) over Bolt/LevelDB for DHT persistence**: SQLite is zero-config and the pure-Go `modernc.org/sqlite` eliminates CGo. The DHT routing table is persisted every 30 seconds so the client re-joins the network quickly after restart. BoltDB would also work but adds an import path for a niche binary format.

- **Bubble Tea over a plain terminal UI**: Writing raw ANSI escape sequences gets painful fast. Bubble Tea provides an Elm-architected framework with a model-update-view loop that maps naturally to a download monitor. The trade-off is a larger binary size (~15 MB vs ~8 MB) from the TUI dependencies.

- **goupnp over manual SSDP**: The UPnP protocol requires SSDP M-SEARCH discovery, XML SOAP parsing, and device description traversal. `goupnp` handles all of this. Without it, you'd need to parse multicast UDP responses and XML SOAP envelopes by hand — not worth it for a feature that's purely a convenience.

### Architecture

```mermaid
flowchart TB
    subgraph Input
        TF[.torrent file] --> TFParse[torrentFile: bencode parse]
        ML[magnet: URI] --> MagParse[magnet: parse xt/dn/tr]
    end

    subgraph Peer Discovery
        TFParse --> InfoHash[20-byte info hash]
        MagParse --> InfoHash
        InfoHash --> Disc[discovery: PeerSource interface]
        Disc --> HTTP[tracker: HTTP tracker]
        Disc --> UDP[udp_tracker: UDP tracker BEP 15]
        Disc --> DHT[dht: Kademlia DHT BEP 5]
        DHT --> DHTBoot[Bootstrap from known nodes]
        DHTBoot --> DHTLookup[iterative find_node get_peers]
        DHTLookup --> DHTStore[(SQLite persistence)]
        HTTP --> PeerChan[deduplicated peer channel]
        UDP --> PeerChan
        DHTLookup --> PeerChan
    end

    subgraph Client Engine
        PeerChan --> PM[peers: PeerManager max 50]
        PM --> PCONN[peers: PeerConnection state machine]
        PCONN --> HS[client: BitTorrent handshake]
        HS --> MSG[client: message loop]
        MSG --> RF[client: rarest-first selection]
        RF --> PIPELINE[client: block pipelining x10]
        PIPELINE --> VERIFY[client: SHA-1 hash verify]
        VERIFY -->|fail| RF
        VERIFY -->|pass| BITFIELD[client: update bitfield]
        BITFIELD --> PEX[pex: BEP 10 PEX exchange]
        PEX --> PM
        MSG --> KA[client: 2-min keep-alive]
    end

    subgraph Storage
        VERIFY --> STORE[storage: multi-file WriteAt]
        STORE --> F1[(file 1)]
        STORE --> F2[(file N)]
    end

    subgraph Network
        UPnP[upnp: IGD port forwarding TCP/UDP]
        UPnP --> Router[(Router)]
    end

    subgraph TUI
        MAIN[cmd/torrent-client/main.go] --> FLAGS[CLI flag parsing]
        FLAGS --> TUI[tui: Bubble Tea input form]
        TUI --> DL[tui: download progress view]
        DL --> CLIENT[client: Start]
    end

    UPnP --> PCONN
    CLIENT --> MSG
```

### Step 1: Structured error handling

File: `pkg/errors/errors.go`

Before writing any protocol code, define a structured error system. Every error carries a typed code, a human message, an optional cause, and context key-value pairs.

```go
type ErrorCode int

const (
    ErrNetwork      ErrorCode = iota
    ErrConnection
    ErrTimeout
    ErrProtocol
    ErrHandshake
    ErrFileNotFound
    ErrPieceHash
    ErrTracker
    ErrConfiguration
    // ...
)

type Error struct {
    Code    ErrorCode
    Message string
    Cause   error
    Context map[string]interface{}
}

func (e *Error) Error() string {
    if e.Cause != nil {
        return fmt.Sprintf("%s: %v", e.Message, e.Cause)
    }
    return e.Message
}

// Common constructors
func NetworkError(message string, cause error) *Error {
    return Wrap(ErrNetwork, message, cause)
}

func PieceHashError(message string, cause error) *Error {
    return Wrap(ErrPieceHash, message, cause)
}
```

**Why structured errors and not plain `fmt.Errorf`?** The `printError` function in `main.go` checks error codes to give users specific recovery suggestions. `fmt.Errorf` loses the code. This approach also powers structured logging — the logger extracts `Code` and `Context` for JSON output.

**Watch out for**: The `errors` package name collides with Go's standard `errors` package. The actual code uses custom constructors to avoid confusion.

### Step 2: Peer type and compact format

File: `pkg/peers/peers.go`

A peer is just an IP and port. The BitTorrent protocol uses "compact" format: 6 bytes for IPv4 (4 bytes IP + 2 bytes port), 18 bytes for IPv6.

```go
type Peer struct {
    IP   net.IP
    Port uint16
}

func (p Peer) String() string {
    return net.JoinHostPort(p.IP.String(), strconv.Itoa(int(p.Port)))
}

func Unmarshal(compactPeers []byte) ([]Peer, error) {
    if len(compactPeers) == 0 {
        return nil, nil
    }
    var peerSize int
    switch {
    case len(compactPeers)%6 == 0:
        peerSize = 6
    case len(compactPeers)%18 == 0:
        peerSize = 18
    default:
        return nil, PeerError{Message: "invalid compact peer format"}
    }

    numPeers := len(compactPeers) / peerSize
    peers := make([]Peer, numPeers)
    for i := 0; i < numPeers; i++ {
        offset := i * peerSize
        if peerSize == 18 {
            ip := make(net.IP, 16)
            copy(ip, compactPeers[offset:offset+16])
            peers[i] = Peer{
                IP:   ip,
                Port: binary.BigEndian.Uint16(compactPeers[offset+16 : offset+18]),
            }
        } else {
            ip := make(net.IP, 4)
            copy(ip, compactPeers[offset:offset+4])
            peers[i] = Peer{
                IP:   ip,
                Port: binary.BigEndian.Uint16(compactPeers[offset+4 : offset+6]),
            }
        }
    }
    return peers, nil
}
```

**Why support both IPv4 (6 byte) and IPv6 (18 byte) compact formats?** Tracker responses and PEX messages can contain either. When the length is divisible by both 6 and 18, IPv4 is preferred (the most common case). The `Unmarshal` function handles this with length-based discrimination.

### Step 3: PeerConnection state machine and exponential backoff

File: `pkg/peers/connection.go`

Every peer connection goes through states: `Disconnected → Connected → Handshaking → Active`. The connection tracks choking state, bitfield, and implements exponential backoff for retries.

```go
type ConnectionState int

const (
    StateDisconnected ConnectionState = iota
    StateConnected
    StateHandshaking
    StateActive
)

type PeerConnection struct {
    Peer              Peer
    Conn              net.Conn
    State             ConnectionState
    Choking           bool     // We are choking the peer
    Interested        bool     // We are interested in the peer
    PeerChoking       bool     // Peer is choking us
    PeerInterested    bool     // Peer is interested in us
    PeerReserved      [8]byte  // Reserved bytes from handshake
    PeerBitfield      []bool   // Which pieces the peer has
    LastActive        time.Time
    FailedAttempts    int
    LastFailedAttempt time.Time
}
```

The `Connect` method dials with a timeout and context support:

```go
func (pc *PeerConnection) Connect(ctx context.Context, timeout time.Duration) error {
    dialer := &net.Dialer{Timeout: timeout}
    conn, err := dialer.DialContext(ctx, "tcp", pc.Peer.String())
    if err != nil {
        return err
    }
    pc.Conn = conn
    pc.State = StateConnected
    pc.LastActive = time.Now()
    return nil
}
```

**Exponential backoff** doubles with each failed attempt, capped at 160 seconds:

```go
func (pc *PeerConnection) ShouldRetry() bool {
    if pc.FailedAttempts == 0 {
        return true
    }
    backoff := time.Duration(10*(1<<min(pc.FailedAttempts-1, 4))) * time.Second
    return time.Since(pc.LastFailedAttempt) >= backoff
}
```

Sequence: 10s, 20s, 40s, 80s, 160s, 160s, ...

**Why exponential backoff?** Without it, the client would hammer unreachable peers in a tight loop, wasting bandwidth and CPU. The 10-second base allows fast retries for transient failures; the 160s cap prevents unbounded waits.

The `PeerManager` wraps a `map[string]*PeerConnection`, limits to `maxPeers` (default 50), and provides `CleanupInactive` which removes peers with no activity for 5+ minutes.

### Step 4: Parsing torrent files

File: `pkg/torrentFile/torrentFile.go`

The `.torrent` file is bencoded. We use `github.com/jackpal/bencode-go` to unmarshal it, then compute the info hash (SHA-1 of the bencoded `info` dict).

```go
type TorrentFile struct {
    Announce    string       // Primary tracker URL
    TrackerURLs []string     // Announce-list URLs (excluding primary)
    InfoHash    [20]byte
    PieceHashes [][20]byte
    PieceLength int
    Length      int          // Total length (sum of all files)
    Name        string
    Files       []FileInfo   // nil for single-file torrents
}

type FileInfo struct {
    Path   []string
    Length int
}

type bencodeInfo struct {
    Pieces      string            `bencode:"pieces"`
    PieceLength int               `bencode:"piece length"`
    Length      int               `bencode:"length"`
    Name        string            `bencode:"name"`
    Files       []bencodeFileInfo `bencode:"files,omitempty"`
}

type bencodeTorrent struct {
    Announce     string        `bencode:"announce"`
    AnnounceList [][]string    `bencode:"announce-list,omitempty"`
    Info         bencodeInfo   `bencode:"info"`
}
```

Opening a torrent file:

```go
func Open(path string) (TorrentFile, error) {
    file, err := os.Open(path)
    if err != nil {
        return TorrentFile{}, err
    }
    defer file.Close()

    bto := bencodeTorrent{}
    err = bencode.Unmarshal(file, &bto)
    if err != nil {
        return TorrentFile{}, err
    }
    return bto.toTorrentFile()
}
```

The `toTorrentFile` method computes the info hash by re-encoding the `bencodeInfo` struct to bencode and taking SHA-1:

```go
func (i *bencodeInfo) hash() ([20]byte, error) {
    var buf bytes.Buffer
    err := bencode.Marshal(&buf, *i)
    if err != nil {
        return [20]byte{}, err
    }
    return sha1.Sum(buf.Bytes()), nil
}
```

Piece hashes are stored contiguously in the `pieces` field (every 20 bytes is one SHA-1 hash):

```go
func (i *bencodeInfo) splitPieceHashes() ([][20]byte, error) {
    buf := []byte(i.Pieces)
    numHashes := len(buf) / 20
    hashes := make([][20]byte, numHashes)
    for i := 0; i < numHashes; i++ {
        copy(hashes[i][:], buf[i*20:(i+1)*20])
    }
    return hashes, nil
}
```

**Why re-marshal the info dict for the hash instead of using the raw bytes?** The `bencode.Unmarshal` → modify → `bencode.Marshal` round-trip ensures the bencoded output is canonical. Using raw bytes from the file would couple the hash computation to the file's exact byte layout, which is fragile across torrent file generators.

**Multi-file support**: When `info.Length` is 0 and `info.Files` is non-empty, it's a multi-file torrent. The total length is the sum of all file lengths. Each file has a `Path` (list of path components) and `Length`.

### Step 5: Magnet URI parsing

File: `pkg/magnet/magnet.go

Magnet links are a decentralized way to identify torrents without a `.torrent` file. The format: `magnet:?xt=urn:btih:<hash>&dn=<name>&tr=<tracker>&ws=<webseed>`.

```go
type MagnetURI struct {
    InfoHash    [20]byte
    Name        string
    Trackers    []string
    WebSeeds    []string
    Length      int64
    ExactLength bool
}

func Parse(magnetURI string) (*MagnetURI, error) {
    if !strings.HasPrefix(magnetURI, "magnet:") {
        return nil, fmt.Errorf("invalid magnet URI: must start with 'magnet:'")
    }

    u, err := url.Parse(magnetURI)
    if err != nil {
        return nil, fmt.Errorf("failed to parse magnet URI: %w", err)
    }

    m := &MagnetURI{}
    xt := u.Query().Get("xt")
    if xt == "" {
        return nil, fmt.Errorf("missing info hash (xt parameter)")
    }
    if !strings.HasPrefix(xt, "urn:btih:") {
        return nil, fmt.Errorf("unsupported hash format: %s", xt)
    }

    hash := strings.TrimPrefix(xt, "urn:btih:")
    infoHash, err := parseInfoHash(hash)
    if err != nil {
        return nil, fmt.Errorf("invalid info hash: %w", err)
    }
    m.InfoHash = infoHash
    m.Name = u.Query().Get("dn")
    // xl, tr, ws...
    return m, nil
}
```

The `parseInfoHash` function handles both hex-encoded (40 chars) and base32-encoded (32 chars) hashes:

```go
func parseInfoHash(hash string) ([20]byte, error) {
    switch len(hash) {
    case 40: // Hex encoded
        decoded, err := hex.DecodeString(hash)
        // ...
    case 32: // Base32 encoded
        decoded, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(strings.ToUpper(hash))
        // ...
    }
}
```

**Why both hex and base32?** The BitTorrent spec (BEP 9) defines a 32-character base32-encoded info hash. Some clients also emit hex. Supporting both means more magnet links work without the user having to convert formats.

### Step 6: Peer wire protocol — handshake and messages

File: `pkg/client/protocol.go`

Every peer connection starts with a 68-byte handshake. The reserved bytes advertise extension protocol support (BEP 10):

```go
const (
    ProtocolString = "BitTorrent protocol"
    ProtocolLen    = 19
)

type Handshake struct {
    Protocol string
    InfoHash [20]byte
    PeerID   [20]byte
    Reserved [8]byte
}

func NewHandshake(infoHash, peerID [20]byte) *Handshake {
    reserved := [8]byte{}
    reserved[5] |= 0x10 // bit 20: BEP 10 extension protocol
    return &Handshake{
        Protocol: ProtocolString,
        InfoHash: infoHash,
        PeerID:   peerID,
        Reserved: reserved,
    }
}
```

**Why set the extension protocol bit?** Without it, peers won't send us BEP 10 extended messages, which means no PEX. The reserved byte at position 5, bit 5 (0x10) signals "I support the extension protocol."

**Peer ID format**: Azureus-style `-GO0100-` + 12 random bytes:

```go
func GeneratePeerID() ([20]byte, error) {
    var peerID [20]byte
    peerID[0] = '-'
    peerID[1] = 'G'
    peerID[2] = 'O'
    peerID[3] = '0'
    peerID[4] = '1'
    peerID[5] = '0'
    peerID[6] = '0'
    peerID[7] = '-'
    _, err := rand.Read(peerID[8:])
    return peerID, err
}
```

After the handshake, peers exchange length-delimited messages:

```go
const (
    MsgChoke         = 0
    MsgUnchoke       = 1
    MsgInterested    = 2
    MsgNotInterested = 3
    MsgHave          = 4
    MsgBitfield      = 5
    MsgRequest       = 6
    MsgPiece         = 7
    MsgCancel        = 8
    MsgExtended      = 20
    MsgKeepAlive     = 255
)

type Message struct {
    ID      byte
    Payload []byte
}

func ReadMessage(conn io.Reader) (*Message, error) {
    lengthBuf := make([]byte, 4)
    _, err := io.ReadFull(conn, lengthBuf)
    if err != nil {
        return nil, err
    }
    length := binary.BigEndian.Uint32(lengthBuf)
    if length == 0 {
        return &Message{ID: MsgKeepAlive, Payload: nil}, nil
    }
    buf := make([]byte, length)
    _, err = io.ReadFull(conn, buf)
    if err != nil {
        return nil, err
    }
    return &Message{ID: buf[0], Payload: buf[1:]}, nil
}

func WriteMessage(conn io.Writer, msg *Message) error {
    data, err := msg.Serialize()
    if err != nil {
        return err
    }
    _, err = conn.Write(data)
    return err
}
```

**Why `io.ReadFull` and not `conn.Read`?** TCP is a stream protocol — `conn.Read` can return fewer bytes than requested (a partial read). `io.ReadFull` loops until the exact number of bytes is received or the connection drops.

**Keep-alive**: Every 2 minutes, the client sends a 4-byte `0x00000000` message (zero length = keep-alive). Without this, peers may time out the connection.

### Step 7: The Client — connecting, handshaking, and message handling

File: `pkg/client/client.go`

The `Client` struct ties everything together:

```go
type Client struct {
    PeerID      [20]byte
    InfoHash    [20]byte
    PeerManager *peers.PeerManager
    Pieces      []PieceState
    PieceLength int
    TotalLength int
    NumPieces   int
    Downloaded  int
    Uploaded    int
    Left        int
    Storage     *storage.Storage
    Log         Logger
}
```

A piece tracks block-level download state:

```go
type PieceState struct {
    Index           int
    Hash            [20]byte
    Downloaded      bool
    Blocks          []bool       // per-block completion
    Active          bool         // being downloaded now
    DownloadedBytes int          // for counter recovery on hash failure
}
```

On creation, the client computes `blocksPerPiece` (16 KB blocks):

```go
func NewClient(infoHash [20]byte, totalLength, pieceLength int, numPieces int, pieceHashes [][20]byte) (*Client, error) {
    blocksPerPiece := (pieceLength + 16383) / 16384 // 16KB blocks
    pieces := make([]PieceState, numPieces)
    for i := 0; i < numPieces; i++ {
        pieces[i] = PieceState{
            Index:  i,
            Hash:   pieceHashes[i],
            Blocks: make([]bool, blocksPerPiece),
        }
    }
    // Last piece might be smaller
    lastPieceBlocks := ((totalLength % pieceLength) + 16383) / 16384
    if totalLength%pieceLength != 0 && lastPieceBlocks < blocksPerPiece {
        pieces[numPieces-1].Blocks = pieces[numPieces-1].Blocks[:lastPieceBlocks]
    }
    // ...
}
```

**Why 16 KB blocks (16384 bytes)?** This is the standard block size used by every major BitTorrent client. Larger blocks waste bandwidth on retransmission; smaller blocks increase protocol overhead (every block requires a request + piece message pair).

The main download loop runs on a 5-second ticker:

```go
func (c *Client) Start(ctx context.Context) error {
    ticker := time.NewTicker(5 * time.Second)
    defer ticker.Stop()
    for {
        select {
        case <-ctx.Done():
            return ctx.Err()
        case <-ticker.C:
            c.maintainConnections(ctx)
            if c.IsComplete() {
                return nil
            }
        }
    }
}
```

**Connecting to a peer** involves dialing TCP, performing the handshake, and verifying the info hash matches:

```go
func (c *Client) ConnectToPeer(ctx context.Context, pc *peers.PeerConnection) error {
    err := pc.Connect(ctx, 10*time.Second)
    if err != nil {
        return err
    }

    hs := NewHandshake(c.InfoHash, c.PeerID)
    hsData, _ := hs.Serialize()
    pc.Conn.Write(hsData)

    response := make([]byte, 68)
    io.ReadFull(pc.Conn, response)

    var responseHS Handshake
    responseHS.Deserialize(response)
    if responseHS.InfoHash != c.InfoHash {
        pc.Disconnect()
        return ProtocolError{Message: "info hash mismatch"}
    }
    // ...
}
```

**Message dispatch**: The `handlePeer` goroutine reads messages in a loop and dispatches to `handleMessage`. The handler processes choke/unchoke, interested, have, bitfield, piece, request, cancel, and extended messages:

```go
func (c *Client) handleMessage(pc *peers.PeerConnection, msg *Message) error {
    switch msg.ID {
    case MsgChoke:
        pc.SetPeerChoking(true)
    case MsgUnchoke:
        pc.SetPeerChoking(false)
        go c.requestBlocks(pc) // Start requesting
    case MsgPiece:
        piece, _ := DeserializePiece(msg.Payload)
        return c.handlePiece(pc, piece)
    case MsgExtended:
        return c.handleExtendedMessage(pc, msg)
    // ...
    }
}
```

### Step 8: Rarest-first piece selection

The rarest-first algorithm selects the least-replicated piece among connected peers. This maximizes the chance that rare pieces survive even if peers disconnect.

```go
func (c *Client) getRarestPiece(pc *peers.PeerConnection) int {
    allPeers := c.PeerManager.GetAllPeers()
    rarity := make([]int, c.NumPieces)
    for i := range rarity {
        rarity[i] = -1 // unknown
    }

    for _, p := range allPeers {
        if p.PeerBitfield == nil {
            continue
        }
        for i := 0; i < c.NumPieces && i < len(p.PeerBitfield); i++ {
            if p.PeerBitfield[i] {
                if rarity[i] < 0 {
                    rarity[i] = 0
                }
                rarity[i]++
            }
        }
    }

    bestPiece := -1
    bestRarity := int(^uint(0) >> 1)
    for i, piece := range c.Pieces {
        if piece.Downloaded || piece.Active {
            continue
        }
        if pc.PeerBitfield != nil && i < len(pc.PeerBitfield) && !pc.PeerBitfield[i] {
            continue // peer doesn't have this piece
        }
        r := rarity[i]
        if r >= 0 && r < bestRarity {
            bestPiece = i
            bestRarity = r
        } else if r < 0 && bestPiece < 0 {
            bestPiece = i // fallback: first available
        }
    }
    return bestPiece
}
```

**Why rarest-first and not sequential?** In sequential download, the first pieces are replicated on every seeder but the last pieces may only exist on a few peers. If those peers leave, the file is stuck at 99%. Rarest-first ensures all pieces have roughly equal replication. The trade-off is you can't stream the file progressively.

**Fallback to first-needed**: When no peers have sent bitfields yet (rarity is unknown), the algorithm falls back to the first undownloaded piece. This avoids stalling while waiting for bitfield messages.

### Step 9: Block pipelining

Once a piece is selected, blocks are requested with pipelining — up to 10 concurrent requests per peer. This keeps the peer's send buffer full and maximizes throughput:

```go
func (c *Client) requestPieceBlocks(pc *peers.PeerConnection, pieceIndex int) {
    c.Pieces[pieceIndex].Active = true

    const maxOutRequests = 10
    sent := 0
    blockSize := 16384

    for blockIndex, downloaded := range blocks {
        if downloaded || sent >= maxOutRequests {
            break
        }
        begin := blockIndex * blockSize
        length := blockSize
        if pieceIndex == c.NumPieces-1 {
            // Last piece may be shorter
            remaining := c.TotalLength - (pieceIndex * c.PieceLength) - begin
            if remaining < blockSize {
                length = remaining
            }
        }

        req := &Request{
            Index:  uint32(pieceIndex),
            Begin:  uint32(begin),
            Length: uint32(length),
        }
        msg := NewMessage(MsgRequest, req.Serialize())
        WriteMessage(pc.Conn, msg)
        sent++
    }
}
```

When a block arrives, the client requests the next undownloaded block (maintaining the pipeline):

```go
func (c *Client) requestNextBlock(pc *peers.PeerConnection, pieceIndex int) error {
    blocks := c.Pieces[pieceIndex].Blocks
    for blockIndex, downloaded := range blocks {
        if !downloaded {
            // Send request for this block
            req := &Request{
                Index:  uint32(pieceIndex),
                Begin:  uint32(blockIndex * blockSize),
                Length: uint32(blockSize),
            }
            msg := NewMessage(MsgRequest, req.Serialize())
            return WriteMessage(pc.Conn, msg)
        }
    }
    return nil // All blocks done
}
```

**Why pipeline and not request-wait-request?** Network latency dominates throughput. Without pipelining, a 100ms RTT means 10 blocks/second max (160 KB/s). With 10 concurrent requests, throughput rises to 1.6 MB/s for the same RTT. The standard suggests 5-10 pending requests per peer.

### Step 10: SHA-1 hash verification and retry

When all blocks of a piece arrive, the client reads the piece back from storage and verifies the SHA-1 hash:

```go
func (c *Client) handlePiece(pc *peers.PeerConnection, piece *Piece) error {
    // Write block to storage
    offset := int64(pieceIndex)*int64(c.PieceLength) + int64(piece.Begin)
    c.Storage.WriteAt(piece.Block, offset)

    // Mark block as downloaded
    c.Pieces[pieceIndex].Blocks[startBlock] = true
    c.Downloaded += len(piece.Block)
    c.Left -= len(piece.Block)

    // Check if all blocks are done
    if allDownloaded {
        // Read back and verify hash
        pieceData := make([]byte, pieceSize)
        c.Storage.ReadAt(pieceData, int64(pieceIndex)*int64(c.PieceLength))

        if !VerifyPieceHash(pieceData, expectedHash) {
            // Hash mismatch: reset piece state for retry
            c.Pieces[pieceIndex].Downloaded = false
            c.Pieces[pieceIndex].Active = false
            c.Pieces[pieceIndex].DownloadedBytes = 0
            for i := range c.Pieces[pieceIndex].Blocks {
                c.Pieces[pieceIndex].Blocks[i] = false
            }
            c.Downloaded -= downloadedBytes
            c.Left += downloadedBytes
            return fmt.Errorf("piece %d hash mismatch", pieceIndex)
        }

        c.Pieces[pieceIndex].Downloaded = true
        c.Pieces[pieceIndex].Active = false
    }
    return nil
}

func VerifyPieceHash(data []byte, expectedHash [20]byte) bool {
    hash := sha1.Sum(data)
    return hash == expectedHash
}
```

**Why read back from storage instead of using in-memory data?** Blocks arrive out of order and are written to disk immediately. The piece data is fragmented in memory. Reading back from storage gives a contiguous view for the hash. This also validates the storage layer — if `WriteAt` corrupted the data, the hash catches it.

**Why reset peer bitfields on hash failure?** A malicious peer could send corrupt blocks. By resetting all blocks, the client will request them from a different peer next time. The `DownloadedBytes` counter is subtracted from the global `Downloaded` total so progress tracking stays accurate.

### Step 11: Storage — single and multi-file

File: `pkg/storage/storage.go`

The storage layer maps global byte offsets to the correct file. For single-file torrents, there's one `FileSpec`. For multi-file torrents, there are multiple `FileSpec`s in order.

```go
type FileSpec struct {
    Path   string
    Length int64
}

type fileEntry struct {
    spec   FileSpec
    file   *os.File
    start  int64   // global start offset
    length int64   // file length
}

type Storage struct {
    entries []fileEntry
    total   int64
    mu      sync.Mutex
}
```

On creation, all files are created and truncated to their expected lengths:

```go
func NewStorage(files []FileSpec) (*Storage, error) {
    entries := make([]fileEntry, len(files))
    var offset int64
    for i, spec := range files {
        os.MkdirAll(filepath.Dir(spec.Path), 0755)
        file, err := os.OpenFile(spec.Path, os.O_RDWR|os.O_CREATE, 0644)
        if err != nil {
            return nil, err
        }
        file.Truncate(spec.Length) // pre-allocate space
        entries[i] = fileEntry{
            spec:   spec,
            file:   file,
            start:  offset,
            length: spec.Length,
        }
        offset += spec.Length
    }
    return &Storage{entries: entries, total: offset}, nil
}
```

`WriteAt` routes to the correct file based on the global offset. If a write spans a file boundary, it splits the write across both files:

```go
func (s *Storage) writeAt(data []byte, off int64) (int, error) {
    idx := s.findEntry(off)
    e := &s.entries[idx]
    localOff := off - e.start
    space := e.length - localOff

    if int64(len(data)) <= space {
        return e.file.WriteAt(data, localOff)
    }

    // Split across file boundary
    n1, _ := e.file.WriteAt(data[:space], localOff)
    n2, _ := s.writeAt(data[space:], off+space)
    return n1 + n2, nil
}
```

**Why truncate files upfront?** Pre-allocating disk space ensures the download won't fail halfway because of disk space. On Linux, `Truncate` creates a sparse file, so no physical space is consumed until data is written. Some filesystems (HFS+, older NTFS) will actually allocate the space, so this doubles as a disk-space check.

**Why `Mutex`-protect writes?** Multiple peer connections write blocks to storage concurrently. Without a mutex, two goroutines could interleave `WriteAt` calls on the same file, corrupting data. The mutex serializes writes at the client level — a minor bottleneck but safe. A sharded approach (one mutex per file) would be an optimization for very high peer counts.

### Step 12: Peer discovery — the PeerSource interface

File: `pkg/discovery/discovery.go`

All peer discovery sources implement the same interface:

```go
type PeerSource interface {
    Name() string
    GetPeers(ctx context.Context, infoHash [20]byte) (<-chan peers.Peer, error)
}
```

The `Discovery` fan-out runs all sources concurrently, deduplicates peers by IP:Port, and merges into a single channel:

```go
func (d *Discovery) Run(ctx context.Context) <-chan peers.Peer {
    out := make(chan peers.Peer)
    var wg sync.WaitGroup
    seen := make(map[string]struct{})

    for _, src := range d.sources {
        wg.Add(1)
        go func(src PeerSource) {
            defer wg.Done()
            ch, err := src.GetPeers(ctx, d.infoHash)
            if err != nil {
                return
            }
            for p := range ch {
                key := p.String()
                if _, ok := seen[key]; ok {
                    continue
                }
                seen[key] = struct{}{}
                out <- p
            }
        }(src)
    }

    go func() {
        wg.Wait()
        close(out)
    }()
    return out
}
```

**Why a merged channel instead of a callback?** Channels compose well with `select`. The client's `maintainConnections` loop runs on a ticker and reads from the peer channel in a separate goroutine. This decouples peer discovery speed from connection management — trackers can find 50 peers in a burst while the client connects to them gradually.

### Step 13: HTTP tracker client

File: `pkg/discovery/tracker.go`

HTTP trackers return bencoded responses with peers in compact format. The client sends `GET` requests with query parameters per BEP 3:

```go
func (s *TrackerSource) queryOnce(ctx context.Context, trackerURL string, infoHash [20]byte, isFirst bool) ([]peers.Peer, int, error) {
    base, _ := url.Parse(trackerURL)
    params := url.Values{
        "port":       []string{strconv.Itoa(int(s.port))},
        "uploaded":   []string{"0"},
        "downloaded": []string{"0"},
        "left":       []string{strconv.Itoa(s.total)},
        "compact":    []string{"1"},
        "numwant":    []string{"50"},
        "info_hash":  []string{string(infoHash[:])},
        "peer_id":    []string{string(s.peerID[:])},
    }
    if isFirst {
        params["event"] = []string{"started"}
    }
    base.RawQuery = params.Encode()

    resp, err := http.Get(base.String())
    // parse bencoded response with safeBencodeDecode (wraps panic)
    trackerResp := bencodeTrackerResp{}
    safeBencodeDecode(bodyBytes, &trackerResp)

    parsed, _ := peers.Unmarshal([]byte(trackerResp.Peers))
    return parsed, interval, nil
}
```

The tracker is queried repeatedly at the returned interval (default 1800s, error backoff 60s). The `safeBencodeDecode` wrapper recovers from panics — `jackpal/bencode-go` panics on malformed input rather than returning errors:

```go
func safeBencodeDecode(data []byte, v interface{}) (err error) {
    defer func() {
        if r := recover(); r != nil {
            err = fmt.Errorf("bencode panic: %v", r)
        }
    }()
    return bencode.Unmarshal(bytes.NewReader(data), v)
}
```

**Why `since'"`  string literals for `info_hash` and `peer_id`?** These are 20-byte binary values. Using `url.QueryEscape(string(hash[:]))` ensures the raw bytes are percent-encoded correctly in the URL. Some trackers reject hex-encoded hashes.

### Step 14: UDP tracker client (BEP 15)

File: `pkg/discovery/udp_tracker.go`

UDP trackers use a binary protocol with a two-step handshake: connect (to get a connection ID) then announce.

**Connect**: Send a 16-byte request, receive a 16-byte response with the connection ID:

```go
func (s *UdpTrackerSource) connect(ctx context.Context, addr string) (uint64, error) {
    req := make([]byte, 16)
    binary.BigEndian.PutUint64(req[0:8], udpMagicConnID) // 0x41727101980
    binary.BigEndian.PutUint32(req[8:12], udpConnectAction) // 0
    copy(req[12:16], transactID) // random transaction ID

    resp, err := s.sendAndReceive(ctx, addr, req, 16)
    // Validate action == 0 and transaction ID matches
    return binary.BigEndian.Uint64(resp[8:16]), nil // connection ID
}
```

**Announce**: Send a 98-byte request with the connection ID, info hash, peer ID, stats, and port:

```go
func (s *UdpTrackerSource) announce(ctx context.Context, addr string, connID uint64, infoHash [20]byte, event uint32) ([]peers.Peer, int, error) {
    req := make([]byte, 98)
    binary.BigEndian.PutUint64(req[0:8], connID)
    binary.BigEndian.PutUint32(req[8:12], udpAnnounceAction) // 1
    copy(req[12:16], transactID)
    copy(req[16:36], infoHash[:])
    copy(req[36:56], s.peerID[:])
    binary.BigEndian.PutUint64(req[56:64], 0)              // downloaded
    binary.BigEndian.PutUint64(req[64:72], uint64(s.total)) // left
    binary.BigEndian.PutUint64(req[72:80], 0)              // uploaded
    binary.BigEndian.PutUint32(req[80:84], event)           // 2=started
    binary.BigEndian.PutUint16(req[96:98], s.port)
    // ...
}
```

Connection IDs are cached with a 55-second expiration:

```go
func (s *UdpTrackerSource) getConnection(ctx context.Context, addr string) (uint64, error) {
    if entry, ok := s.connCache[addr]; ok && time.Now().Before(entry.expiresAt) {
        return entry.connID, nil
    }
    connID, err := s.connect(ctx, addr)
    s.connCache[addr] = &udpConnEntry{connID: connID, expiresAt: time.Now().Add(55 * time.Second)}
    return connID, nil
}
```

**Why 55 seconds and not the protocol's 60-second default?** The UDP tracker protocol says connection IDs expire after 60 seconds. Using 55 seconds gives a 5-second buffer so a request timed perfectly at the 60-second boundary doesn't fail with `connection ID not found`. If the tracker rejects the connection ID, the cache entry will be evicted and a new connect will be attempted.

**Why 2 retries with exponential backoff?** The `sendAndReceive` method retries up to 2 times with a 15-second timeout. UDP packets are unreliable — a single packet loss shouldn't prevent peer discovery. The 15*(2^attempt) backoff (15s, 30s) gives the tracker time to respond without hanging too long.

### Step 15: Kademlia DHT (BEP 5)

The DHT implements a Kademlia distributed hash table for finding peers without a central tracker.

#### Node initialization

File: `pkg/dht/node.go`

```go
type Node struct {
    id      []byte      // 160-bit random node ID
    port    int
    conn    *net.UDPConn
    routing *routingTable
    pending map[string]chan *krpcMsg // pending queries by transaction ID
    store   *dhtStore                // SQLite persistence
    peerStore map[string][]peerAddr  // announced peers per info hash
    tokenSecret string               // for token validation
}

func NewNode(port int, log Logger) (*Node, error) {
    id := generateNodeID() // 20 random bytes
    addr := &net.UDPAddr{Port: port}
    conn, err := net.ListenUDP("udp4", addr)
    // ...
}
```

#### Routing table

File: `pkg/dht/routing.go`

The routing table uses k-buckets (k=20). Each bucket stores nodes that share a certain prefix length with the local node. When a bucket fills up at the local node's depth, it splits into two:

```go
func (rt *routingTable) insert(n nodeInfo) {
    if equalIDs(n.id, rt.selfID) {
        return
    }
    depth := commonBits(rt.selfID, n.id)
    bucketIdx := min(depth, len(rt.buckets)-1)
    b := rt.buckets[bucketIdx]

    for i, existing := range b.nodes {
        if equalIDs(existing.id, n.id) {
            // Move to front (most recently seen)
            b.nodes = append(b.nodes[:i], b.nodes[i+1:]...)
            b.nodes = append(b.nodes, n)
            return
        }
    }

    if len(b.nodes) < k {
        b.nodes = append(b.nodes, n)
        return
    }

    // Bucket full — split if the split would help
    if bucketIdx < maxBucketDepth-1 {
        rt.splitBucket(bucketIdx)
        rt.insert(n) // re-insert into correct bucket
    }
}
```

The `closestNodes` function returns the k closest nodes to a target by XOR distance:

```go
func (rt *routingTable) closestNodes(target []byte, count int) []nodeInfo {
    // Collect all nodes, sort by XOR distance to target
    sort.Slice(all, func(i, j int) bool {
        di := xorDistance(target, all[i].id)
        dj := xorDistance(target, all[j].id)
        return bytesLess(di, dj)
    })
    return all[:count]
}
```

#### KRPC protocol

File: `pkg/dht/krpc.go`

DHT messages are bencoded dictionaries with keys: `t` (transaction ID), `y` (type: q/r/e), `q` (query type), `a` (args), `r` (response). Four query types are supported:

```go
const (
    qPing         = "ping"
    qFindNode     = "find_node"
    qGetPeers     = "get_peers"
    qAnnouncePeer = "announce_peer"
)
```

Manual bencode parsing is used here (instead of `jackpal/bencode-go`) to handle the streaming, nested bencode dict without panicking:

```go
func decodeMessage(data []byte) (*krpcMsg, error) {
    // Manual streaming bencode parser
    // Handles dict key-by-key so we can extract t, y, q, a, r
    // without re-marshaling
}
```

Nodes are encoded compactly: 26 bytes for IPv4 (20-byte node ID + 4-byte IP + 2-byte port), 38 bytes for IPv6 (BEP 32):

```go
func compactNodeInfo(id []byte, addr *net.UDPAddr) []byte {
    ip4 := addr.IP.To4()
    if ip4 != nil {
        buf := make([]byte, 26)
        copy(buf[:20], id[:20])
        copy(buf[20:24], ip4)
        buf[24] = byte(addr.Port >> 8)
        buf[25] = byte(addr.Port)
        return buf
    }
    // IPv6: 38 bytes
    buf := make([]byte, 38)
    // ...
}
```

#### Bootstrapping

The DHT node joins the network by sending `find_node` queries to hardcoded bootstrap nodes:

```go
var bootstrapNodes = []string{
    "router.bittorrent.com:6881",
    "dht.transmissionbt.com:6881",
    "router.utorrent.com:6881",
    // ...
}
func (n *Node) Bootstrap(ctx context.Context) error {
    for _, addr := range bootstrapNodes {
        go func(addr string) {
            resp, err := n.findNode(ctx, udpAddr, n.id)
            if resp.R.Nodes != "" {
                nodes, _ := parseCompactNodes(resp.R.Nodes)
                for _, node := range nodes {
                    n.routing.insert(node)
                }
            }
        }(addr)
    }
}
```

**Why multiple bootstrap nodes?** Any single bootstrap node could be down. The client sends queries in parallel to all of them and inserts all discovered nodes into the routing table. As long as one bootstrap node responds, the routing table gets populated.

#### Iterative lookup (find_node/get_peers)

The `lookup` method implements Kademlia's iterative routing: repeatedly query the k closest known nodes, insert any closer nodes returned, and continue until no new nodes are discovered:

```go
func (n *Node) lookup(ctx context.Context, target []byte) ([]nodeInfo, error) {
    closest := n.routing.closestNodes(target, k)
    queried := make(map[string]bool)

    for {
        var toQuery []nodeInfo
        for _, node := range closest {
            if !queried[node.addr.String()] {
                toQuery = append(toQuery, node)
                queried[node.addr.String()] = true
            }
        }
        if len(toQuery) == 0 {
            break // All known nodes have been queried
        }
        // Query all unqueried nodes in parallel
        var wg sync.WaitGroup
        for _, node := range toQuery {
            go func(nn nodeInfo) {
                resp, _ := n.findNode(ctx, nn.addr, target)
                if resp.R.Nodes != "" {
                    found, _ := parseCompactNodes(resp.R.Nodes)
                    for _, fn := range found {
                        n.routing.insert(fn)
                    }
                }
            }(node)
        }
        wg.Wait()
    }
    return n.routing.closestNodes(target, k), nil
}
```

The `GetPeers` method wraps this lookup and additionally asks each close node for `get_peers`:

```go
func (n *Node) GetPeers(ctx context.Context, infoHash []byte) ([]peerAddr, error) {
    closest, _ := n.lookup(ctx, infoHash)
    for _, node := range closest {
        peers, err := n.getPeersFromNode(ctx, nn.addr, infoHash)
        if err == nil && len(peers) > 0 {
            allPeers = append(allPeers, peers...)
        }
    }
    // Deduplicate by IP:Port
    return deduped, nil
}
```

#### DHT as a PeerSource

File: `pkg/dht/discovery.go`

The DHT wraps itself as a `PeerSource` so it can be used alongside trackers in the discovery fan-out:

```go
type dhtPeerSource struct {
    node *Node
}

func (s *dhtPeerSource) GetPeers(ctx context.Context, infoHash [20]byte) (<-chan peers.Peer, error) {
    ch := make(chan peers.Peer)
    go func() {
        defer close(ch)
        s.node.Bootstrap(ctx)
        for {
            addrs, err := s.node.GetPeers(ctx, infoHash[:])
            if err == nil {
                for _, a := range addrs {
                    ch <- peers.Peer{IP: a.IP, Port: uint16(a.Port)}
                }
            }
            select {
            case <-time.After(60 * time.Second):
            case <-ctx.Done():
                return
            }
        }
    }()
    return ch, nil
}
```

#### SQLite persistence

File: `pkg/dht/store.go`

The routing table is persisted to SQLite every 30 seconds so the node remembers known good nodes across restarts:

```go
type dhtStore struct {
    db *sql.DB
}

const dhtSchema = `
CREATE TABLE IF NOT EXISTS dht_nodes (
    node_id BLOB  NOT NULL PRIMARY KEY,
    ip      TEXT   NOT NULL,
    port    INTEGER NOT NULL,
    seen_at INTEGER NOT NULL
);`

func (s *dhtStore) save(nodes []nodeInfo) error {
    tx, _ := s.db.Begin()
    tx.Exec("DELETE FROM dht_nodes")
    stmt, _ := tx.Prepare("INSERT OR REPLACE INTO dht_nodes (node_id, ip, port, seen_at) VALUES (?, ?, ?, ?)")
    for _, n := range nodes {
        stmt.Exec(n.id, n.addr.IP.String(), n.addr.Port, time.Now().Unix())
    }
    return tx.Commit()
}
```

**Why SQLite and not a JSON file?** A JSON file with hundreds of nodes requires reading and parsing the entire file on every save. SQLite provides efficient point updates, indexing by `seen_at` for pruning old nodes, and transactional integrity. The pure-Go `modernc.org/sqlite` driver means no CGo dependency.

**Why only 1000 nodes on load?** The `load` query uses `ORDER BY seen_at DESC LIMIT 1000`. Old nodes may have gone offline. Loading only the most recently seen 1000 nodes keeps the routing table fresh and reduces startup time.

### Step 16: PEX — Peer Exchange (BEP 10)

File: `pkg/pex/pex.go`

PEX lets peers share their known peer lists, enabling "peer gossiping." It uses the BitTorrent extension protocol (BEP 10).

**Extension handshake**: When a connection is established, the client sends an extended message with ID 0 containing a bencoded dict advertising supported extensions:

```go
func ExtensionHandshake() ([]byte, error) {
    dict := map[string]interface{}{
        "m": map[string]interface{}{
            "ut_pex": int64(OurPEXID), // 1
        },
        "v": "torrent-client/1.0.0",
    }
    var buf bytes.Buffer
    bencode.Marshal(&buf, dict)
    return buf.Bytes(), nil
}
```

**Parsing the peer's handshake** extracts the message ID they use for `ut_pex`:

```go
func ParseExtHandshake(payload []byte) (byte, error) {
    var resp struct {
        M map[string]int64 `bencode:"m"`
    }
    safeUnmarshal(payload, &resp)
    pexID, ok := resp.M["ut_pex"]
    if !ok || pexID <= 0 || pexID > 255 {
        return 0, fmt.Errorf("peer does not support ut_pex")
    }
    return byte(pexID), nil
}
```

**PEX messages** are bencoded dicts with `added` (compact peer list) and `dropped` (peers to remove):

```go
func MarshalPEX(added, dropped []peers.Peer) ([]byte, error) {
    dict := make(map[string]interface{})
    if len(added) > 0 {
        dict["added"] = compactPeers(added)
        dict["added.f"] = make([]byte, len(added)) // flags (all 0)
    }
    if len(dropped) > 0 {
        dict["dropped"] = compactPeers(dropped)
    }
    var buf bytes.Buffer
    bencode.Marshal(&buf, dict)
    return buf.Bytes(), nil
}
```

In the client's message loop, when an extended message arrives, it dispatches to `handleExtendedMessage`. This stores the peer's PEX message ID on first contact, and on subsequent messages parses the PEX payload and adds discovered peers:

```go
func (c *Client) handlePEXMessage(payload []byte) error {
    added, _, _ := pex.UnmarshalPEX(payload)
    if len(added) > 0 {
        c.AddPeers(added)
    }
    return nil
}
```

Every ~60 seconds (12 ticks at 5s each), the client sends its own PEX message to all connected peers that support it:

```go
func (c *Client) sendPEXToPeers() {
    // Build list of active peers excluding the target
    var pexPeers []peers.Peer
    for _, p := range activePeers {
        if p.State == peers.StateActive && p.Peer.String() != target.Peer.String() {
            pexPeers = append(pexPeers, p.Peer)
        }
    }
    payload, _ := pex.MarshalPEX(pexPeers, nil)
    msg := NewMessage(MsgExtended, append([]byte{state.pexMsgID}, payload...))
    WriteMessage(target.Conn, msg)
}
```

**Why exclude the target peer from the PEX list?** Sending the target's own address back to them is pointless. Worse, the target might see itself in the `added` list and try to connect to itself, which would fail.

### Step 17: UPnP port forwarding

File: `pkg/upnp/upnp.go`

UPnP IGD (Internet Gateway Device) port forwarding punches a hole in the router's NAT so incoming peer connections can reach the client. Uses `github.com/huin/goupnp` for SSDP discovery.

**Discovery**: The `discoverMapper` function tries three UPnP service types in order: WANIPConnection2, WANIPConnection1, WANPPPConnection1:

```go
func discoverMapper(ctx context.Context, log Logger) (portMapper, bool) {
    discoveries := []discovery{
        {name: "WANIPConnection2", find: internetgateway2.NewWANIPConnection2ClientsCtx},
        {name: "WANIPConnection1", find: internetgateway2.NewWANIPConnection1ClientsCtx},
        {name: "WANPPPConnection1", find: internetgateway2.NewWANPPPConnection1ClientsCtx},
    }
    for _, d := range discoveries {
        dCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
        clients, _, err := d.find(dCtx)
        cancel()
        if err == nil && len(clients) > 0 {
            return clients[0], true
        }
    }
    return nil, false
}
```

**Why 3-second timeout per service type?** `goupnp` sends SSDP M-SEARCH packets over UDP and waits for responses. Without a timeout, it could block for 30+ seconds if no UPnP device exists. 3 seconds per attempt, 3 attempts = 9 seconds max.

**Port mapping**: Once a mapper is found, both TCP and UDP ports are mapped:

```go
func (c *IGDClient) AddMapping(ctx context.Context, protocol string, port uint16, description string) error {
    err := c.mapper.AddPortMapping("", port, protocol, port, c.localIP, true, desc, 0)
    // ...
}
```

The `localIPv4()` function determines the local IP by dialing a UDP connection (but not sending data):

```go
func localIPv4() (string, error) {
    conn, err := net.Dial("udp4", "1.1.1.1:53")
    ip := conn.LocalAddr().(*net.UDPAddr).IP.String()
    return ip, nil
}
```

**Why dial `1.1.1.1:53` and not just read the routing table?** Any public UDP address works — the dial picks the interface that would be used to reach that address. No actual data is sent (the UDP "connection" is purely local). This is more reliable than parsing `net.InterfaceAddrs` which might return loopback or Docker bridge IPs.

**Cleanup**: `RemoveAll()` is called on shutdown via `defer`:

```go
defer igd.RemoveAll()
func (c *IGDClient) RemoveAll() {
    for _, m := range c.mappings {
        c.mapper.DeletePortMapping("", m.port, m.protocol)
    }
    c.mappings = nil
}
```

### Step 18: Main entry point — CLI and orchestration

File: `cmd/torrent-client/main.go`

The entry point ties everything together: parses flags, sets up logging, initializes UPnP, opens the torrent file (or parses a magnet link), creates the client, starts peer discovery (trackers + DHT), and launches the TUI.

**Flag parsing**: Manual flag parsing (no `flag` package) for cleaner help output:

```go
func parseFlags(args []string) (*Options, error) {
    opts := &Options{}
    for i := 0; i < len(args); i++ {
        switch arg := args[i]; arg {
        case "-h", "--help":     opts.Help = true
        case "-v", "--version":  opts.Version = true
        case "-V", "--verbose":  opts.Verbose = true
        case "-o", "--output":   opts.OutputDir = args[i+1]; i++
        case "-p", "--port":     fmt.Sscanf(args[i+1], "%d", &opts.Port); i++
        case "-m", "--max-peers": fmt.Sscanf(args[i+1], "%d", &opts.MaxPeers); i++
        // ...
        }
    }
}
```

**Orchestration in `startDownload`**:

1. Set up signal handling for graceful shutdown (`SIGINT`, `SIGTERM`)
2. Discover UPnP IGD and forward TCP/UDP ports
3. Parse the input: `.torrent` file via `torrentFile.Open()` or magnet URI via `magnet.Parse()`
4. Create the `Client` with info hash, piece hashes, length
5. Initialize `Storage` (single or multi-file)
6. Create peer discovery sources: HTTP tracker, UDP tracker, DHT
7. Run discovery fan-out and feed peers into the client
8. Start the download in a goroutine
9. Launch the Bubble Tea TUI

```go
func (app *App) startDownload(isMagnet bool) error {
    // 1. UPnP
    igd, igdErr := upnp.NewIGDClient(ctx, app.logger)
    if igdErr == nil {
        igd.AddMapping(ctx, "TCP", port, "torrent-client (peer)")
        igd.AddMapping(ctx, "UDP", port, "torrent-client (peer)")
        defer igd.RemoveAll()
    }

    // 2. Parse input
    var tf torrentFile.TorrentFile
    if isMagnet {
        m, _ := magnet.Parse(app.opts.TorrentFile)
        tf = torrentFile.TorrentFile{InfoHash: m.InfoHash, Name: m.Name, Length: int(m.Length)}
    } else {
        tf, _ = torrentFile.Open(app.opts.TorrentFile)
    }

    // 3. Create client
    c, _ := client.NewClient(tf.InfoHash, tf.Length, tf.PieceLength, len(tf.PieceHashes), tf.PieceHashes)
    c.Storage = s

    // 4. Peer discovery
    trackerSrc := discovery.NewTrackerSource("", httpURLs, peerID, port, tf.Length, app.logger)
    udpTrackerSrc := discovery.NewUdpTrackerSource(udpURLs, peerID, port, tf.Length, app.logger)
    dhtNode, _ := dht.NewNode(int(port), app.logger)
    dhtNode.Start(ctx)

    sources := []discovery.PeerSource{trackerSrc, udpTrackerSrc, dhtNode.AsPeerSource()}
    disc := discovery.New(sources, tf.InfoHash)
    peerChan := disc.Run(ctx)

    // 5. Feed peers
    go func() {
        for p := range peerChan {
            c.AddPeers([]peers.Peer{p})
        }
    }()

    // 6. Start download + TUI
    go func() { errChan <- c.Start(ctx) }()
    result, _ := tui.RunDownload(c, tf.Name, cancel, errChan)
}
```

### Step 19: Terminal UI with Bubble Tea

The TUI has two screens: a torrent input form and a download progress view.

#### Torrent input form

File: `tui/tui.go`

Uses Bubble Tea with `textinput` widgets. Step 0 asks for a torrent file path or magnet URL with tab-completion for file paths. Step 1 asks for optional settings (output dir, port, max peers).

```go
type model struct {
    step         int
    source       string
    filePath     textinput.Model
    magnetUrl    textinput.Model
    outputDir    textinput.Model
    port         textinput.Model
    maxPeers     textinput.Model
    torrentInput *TorrentInput
    // completions
    completions     []string
    completionIdx   int
    completionBase  string
    showCompletions bool
}
```

The model follows the Elm architecture: `Init` → `Update` → `View`. The `View` method renders styled output with ANSI colors:

```go
func (m model) View() string {
    s := header()
    s += stepTitle("1", "Choose torrent source")
    s += inputField("Torrent File", m.filePath, m.focusedInput == "file")
    s += m.completionsView()
    s += inputField("Magnet URL", m.magnetUrl, m.focusedInput == "magnet")
    // ...
    s += m.helpBar()
    return s
}
```

**Why two screens instead of one?** The first screen focuses on the torrent source (the only required input). Settings are secondary and would clutter the initial view. The `step` field tracks which screen is active.

#### Download progress view

File: `tui/download.go`

A separate Bubble Tea model shows real-time download progress with a unicode progress bar, speed, ETA, and peer count:

```go
type DownloadModel struct {
    client      *client.Client
    name        string
    cancel      context.CancelFunc
    errChan     chan error
    progress    float64
    downloaded  int64
    total       int64
    speed       float64
    activePeers int
    totalPeers  int
    piecesDone  int
    totalPieces int
    elapsed     time.Duration
    eta         time.Duration
}
```

The view updates every 500ms:

```go
func (m *DownloadModel) View() string {
    s.WriteString(fmt.Sprintf("  Downloading: %s\n", truncate(m.name, 50)))
    s.WriteString(fmt.Sprintf("  %s  %5.1f%%\n", progressBar(40, m.progress), m.progress))
    s.WriteString(fmt.Sprintf("  Speed:   %s/s\n", formatBytes(int64(m.speed))))
    s.WriteString(fmt.Sprintf("  ETA:     %s\n", formatDuration(m.eta)))
    s.WriteString(fmt.Sprintf("  Peers:   %d active / %d total\n", m.activePeers, m.totalPeers))
    s.WriteString(fmt.Sprintf("  Pieces:  %d / %d\n", m.piecesDone, m.totalPieces))
}
```

**Why `RunDownload` uses `tea.WithAltScreen()`**? The alternate screen buffer lets the download view take over the full terminal without cluttering the scrollback. When the download completes, the terminal scrollback is restored.

### Step 20: Configuration management

File: `pkg/config/config.go`

The config package provides a serializable `Config` struct with defaults, JSON file load/save, and validation:

```go
type Config struct {
    Port           int           `json:"port"`
    MaxPeers       int           `json:"max_peers"`
    DownloadDir    string        `json:"download_dir"`
    LogLevel       string        `json:"log_level"`
    ConnectTimeout time.Duration `json:"connect_timeout"`
    ChunkSize      int           `json:"chunk_size"` // 16384 = 16KB
    // ...
}
```

**Why JSON and not YAML or TOML?** Go's standard `encoding/json` requires no additional dependencies. The config file is simple enough that JSON's lack of comments is not a problem.

**Validation**: `Validate()` checks port range (1-65535), max peers (1-1000), timeout minimum (1s), chunk size (1KB-1MB), and log level (debug/info/warn/error). Invalid configurations fail at startup rather than mid-download.

### Step 21: Structured logging

File: `internal/logger/logger.go`

The logger uses a channel-based background processor for non-blocking writes. Entries contain timestamp, level, module, message, structured fields, and optional error info:

```go
type Logger struct {
    level      LogLevel
    module     string
    entries    chan *LogEntry  // buffered channel (cap 1000)
    file       *os.File       // optional log file
}

func (l *Logger) log(level LogLevel, message string, fields map[string]interface{}, err error) {
    if !l.shouldLog(level) {
        return
    }
    entry := &LogEntry{
        Timestamp: time.Now(),
        Level:     level.String(),
        Message:   message,
        Module:    l.module,
        Fields:    fields,
    }
    // Send to background processor; drop if channel full
    select {
    case l.entries <- entry:
    default:
        // Channel full, drop message
    }
}
```

**Why channel-based background processing?** Logging calls happen in hot paths (per-message in the peer loop). Without a background processor, the peer goroutine would block on every log write. The buffered channel (cap 1000) absorbs bursts; if it overflows, entries are dropped silently rather than blocking the client.

**Why both text and JSON formats?** Text format is human-readable for development (`[2024-01-15 10:00:00] INFO [torrent-client]: piece verified`). JSON format (enabled via `LOG_FORMAT=json`) is machine-parseable for production monitoring systems like Logstash or Datadog.

### Feature comparison

| Feature | This client | Transmission | qBittorrent | rTorrent |
|---------|-------------|-------------|-------------|----------|
| DHT (BEP 5) | Yes (Kademlia + SQLite) | Yes | Yes | Yes |
| PEX (BEP 10) | Yes | Yes | Yes | Yes |
| Magnet links | Yes (hex + base32) | Yes | Yes | Yes |
| UDP trackers (BEP 15) | Yes | Yes | Yes | Yes |
| UPnP port forwarding | Yes (goupnp) | Yes | Yes | No |
| Rarest-first selection | Yes | Yes | Yes | Yes |
| Block pipelining | Yes (10 concurrent) | Yes | Yes | Yes |
| Multi-file torrents | Yes | Yes | Yes | Yes |
| SHA-1 hash verification | Yes | Yes | Yes | Yes |
| Exponential backoff | Yes | Yes | Yes | Yes |
| Terminal UI | Bubble Tea TUI | GTK / Qt | Qt / WebUI | ncurses |
| Language | Go (single binary) | C (daemon + UI) | C++ (Qt) | C++ (ncurses) |
| Config format | JSON | JSON | Advanced INI | rc file |
| CGo dependency | No (pure Go SQLite) | No | No | No |
| Binary size | ~15 MB (TUI) | ~5 MB (daemon only) | ~30 MB | ~5 MB |
| DHT persistence | SQLite | JSON file | fastresume file | fastresume |

### Next steps

- **Encryption (MSE/PE)**: Add protocol encryption (BEP 18) for ISP throttling bypass. This requires Diffie-Hellman key exchange and RC4 encryption of the peer stream.
- **µTP transport**: Implement the micro transport protocol (BEP 29) for better UDP-based transfers with LEDBAT congestion control that yields to TCP.
- **WebTorrent**: Support the WebTorrent protocol for in-browser peers using WebRTC (BEP 52).
- **Sequential download**: Add a sequential download mode for streaming media files, where pieces are requested in order rather than rarest-first.
- **Seeding mode**: Implement a seeding mode where the client uploads completed pieces to peers after the download finishes.

The full source is at [github.com/veggiedefender/torrent-client](https://github.com/veggiedefender/torrent-client).

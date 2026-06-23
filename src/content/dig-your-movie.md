## How to Build a DNS Server That Returns Movie Descriptions

In this tutorial, we'll build Dig Your Movie — a custom DNS server in Go that takes a movie name encoded in a domain query and returns its OMDB plot description as a TXT record. Instead of hitting a REST API directly, you `dig` for it.

### What to expect

```bash
$ dig @localhost -p 8095 movie.info.the.matrix. TXT +short

"Thomas A. Anderson is a man living two lives. By day he is an average computer programmer and by night a hacker known as Neo. Neo has always questioned his reality, but the truth is far beyond his imagination. He finds himself..."

$ go run cmd/client/main.go "The Matrix"
Thomas A. Anderson is a man living two lives. By day he is an average computer programmer and by night a hacker known as Neo. Neo has always questioned his reality, but the truth is far beyond his imagination. He finds himself...
```

### What you'll learn

- Building a raw UDP DNS server in Go without a framework
- Parsing and constructing DNS wire-format messages with `github.com/miekg/dns`
- Routing queries by domain patterns using string splitting
- Querying the OMDB API and embedding responses in TXT records
- Working within DNS protocol limits (512-byte UDP, 255-char TXT strings)
- Multi-stage Docker builds for Go binaries

### Prerequisites

- Go 1.20+
- Basic understanding of DNS (record types, wire format)
- An OMDB API key (a default dev key is provided in the repo)

### Project structure

```
dig-your-movie/
├── cmd/
│   ├── server/
│   │   └── main.go           # DNS server entry point
│   └── client/
│       └── main.go           # CLI query tool
├── internal/
│   ├── config/
│   │   └── config.go         # Env-based configuration
│   ├── dns/
│   │   └── server.go         # UDP handler, router, TXT response builder
│   └── omdb/
│       └── client.go         # OMDB API HTTP client
├── Dockerfile                # Multi-stage build
├── go.mod
└── go.sum
```

### Imports

**Go (server side)**

| Package | Why |
|---------|-----|
| `github.com/miekg/dns` | DNS library — message packing/unpacking, RR creation. No framework, just the protocol primitives. |
| `net/http` | OMDB API calls |
| `net` | Raw UDP socket for the DNS listener |

**Why these choices?**

- **`net.ListenUDP` over `miekg/dns`'s built-in server**: The original code manually reads from a `*net.UDPConn`, unpacks with `msg.Unpack()`, and writes the packed response. This gives full control over the read loop and avoids the opinionated handler pattern of `dns.Server`. Trade-off: you lose built-in TCP fallback, compression, and EDNS0 handling.

- **`strings.Split` for routing over regex**: There's no router library. The query name `movie.info.the.matrix.` is trimmed of the trailing dot, split on `.`, and validated as `parts[0] == "movie"` and `parts[1] == "info"`. It's minimal and fast, but a movie title containing a dot (e.g. "Mr. Robot") would be misinterpreted — the server joins `parts[2:]` with spaces, turning "Mr. Robot" into "Mr Robot".

- **OMDB over a database**: No local cache or storage. Every query fetches fresh from OMDB. Simple but slow — no TTL-based caching. The TTL on the TXT record is set to 3600, but since each request triggers an HTTP call, you'd hit OMDB's rate limits quickly.

### Architecture

```mermaid
flowchart TB
    subgraph Client
        D[dig @localhost -p 8095]
        C[go run cmd/client/main.go]
    end
    subgraph Server
        U[UDP Listener :8095]
        R[Router: parts = split(query, '.')]
        V{parts[0]=="movie"\nand parts[1]=="info"?}
        E[OMDB Client]
    end
    subgraph External
        O[OMDB API\nwww.omdbapi.com]
    end

    D -->|TXT query| U
    C -->|TXT query| U
    U -->|Unpack DNS msg| R
    R --> V
    V -->|yes| E
    V -->|no| I["Return TXT:\n'invalid request format'"]
    E -->|GET /?apikey=&t=| O
    O -->|Plot JSON| E
    E -->|Truncate to 250 chars| T["Return TXT:\nmovie description"]
```

### Step 1: Configuration from environment

File: `internal/config/config.go`

```go
package config

import (
    "os"
    "strconv"
)

type Config struct {
    APIKey string
    Port   int
}

func Load() *Config {
    apiKey := os.Getenv("API_KEY")
    if apiKey == "" {
        apiKey = "9496f5e1" // Default for dev
    }

    portStr := os.Getenv("PORT")
    port, err := strconv.Atoi(portStr)
    if err != nil {
        port = 8095
    }

    return &Config{
        APIKey: apiKey,
        Port:   port,
    }
}
```

**Why a default API key?** The repo includes a working dev key so you can run the server immediately without signing up for OMDB. Replace it with your own for any serious use — the dev key has strict rate limits.

**Why `strconv.Atoi` without explicit error logging?** If `PORT` isn't set or isn't a number, the function silently falls back to 8095. This is deliberate — the server should start without ceremony in development. In production you'd want to log a warning or fail hard on a malformed port.

### Step 2: OMDB API client

File: `internal/omdb/client.go`

```go
package omdb

import (
    "context"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "net/url"
    "time"
)

const baseURL = "http://www.omdbapi.com/"

type Movie struct {
    Title       string `json:"Title"`
    Description string `json:"Plot"`
    Year        string `json:"Year"`
    Director    string `json:"Director"`
    Error       string `json:"Error"`
}

type Client struct {
    apiKey     string
    httpClient *http.Client
}

func NewClient(apiKey string) *Client {
    return &Client{
        apiKey: apiKey,
        httpClient: &http.Client{
            Timeout: 10 * time.Second,
        },
    }
}

func (c *Client) GetMovieDescription(ctx context.Context, movieName string) (Movie, error) {
    queryParams := url.Values{
        "apikey": {c.apiKey},
        "t":      {movieName},
    }
    u := baseURL + "?" + queryParams.Encode()

    req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
    if err != nil {
        return Movie{}, fmt.Errorf("failed to create request: %w", err)
    }

    resp, err := c.httpClient.Do(req)
    if err != nil {
        return Movie{}, fmt.Errorf("request failed: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return Movie{}, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
    }

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return Movie{}, fmt.Errorf("failed to read response body: %w", err)
    }

    var movie Movie
    if err := json.Unmarshal(body, &movie); err != nil {
        return Movie{}, fmt.Errorf("failed to decode response: %w", err)
    }

    if movie.Error != "" {
        return Movie{}, fmt.Errorf("omdb api error: %s", movie.Error)
    }

    return movie, nil
}
```

The struct only extracts `Title`, `Plot`, `Year`, and `Director` — the fields that make sense for a DNS TXT response. The `Error` field catches OMDB's JSON error response (e.g. "Movie not found!"), which OMDB returns as HTTP 200 with `{"Error": "..."}` rather than a 404.

**Why `io.ReadAll` and not `json.NewDecoder`?** The OMDB response is small (one movie object). `ReadAll` followed by `json.Unmarshal` is simpler and you get the full body for debugging. The decoder would read from the stream directly, but you lose the ability to log the raw response.

### Step 3: The DNS server

File: `internal/dns/server.go`

```go
package dns

import (
    "context"
    "fmt"
    "log"
    "net"
    "strings"

    "github.com/miekg/dns"
    "github.com/priyanshu360/dig-your-movie/internal/config"
    "github.com/priyanshu360/dig-your-movie/internal/omdb"
)

type Server struct {
    addr       string
    omdbClient *omdb.Client
}

func NewServer(cfg *config.Config, omdbClient *omdb.Client) *Server {
    return &Server{
        addr:       fmt.Sprintf(":%d", cfg.Port),
        omdbClient: omdbClient,
    }
}

func (s *Server) Run() error {
    log.Printf("Starting UDP server on %s", s.addr)
    addr, err := net.ResolveUDPAddr("udp", s.addr)
    if err != nil {
        return err
    }

    conn, err := net.ListenUDP("udp", addr)
    if err != nil {
        return err
    }
    defer conn.Close()

    for {
        buf := make([]byte, 512)
        _, clientAddr, err := conn.ReadFromUDP(buf)
        if err != nil {
            log.Printf("Error reading from UDP: %v", err)
            continue
        }

        go s.handleRequest(conn, clientAddr, buf)
    }
}
```

**Why a 512-byte buffer?** That's the DNS message size limit for standard UDP (RFC 1035). If the packed response exceeds 512 bytes, it gets truncated. The OMDB plot description is well under this limit even after wrapping in a DNS message.

**Why `go s.handleRequest`?** Each DNS query gets a goroutine. This is fine for a toy server — Go's scheduler handles thousands of goroutines. For production you'd want a worker pool to control concurrency, otherwise a flood of queries could exhaust memory.

#### UDP handler

```go
func (s *Server) handleRequest(conn *net.UDPConn, clientAddr *net.UDPAddr, buf []byte) {
    msg := new(dns.Msg)
    if err := msg.Unpack(buf); err != nil {
        log.Printf("Error decoding DNS message: %v", err)
        return
    }

    if len(msg.Question) == 0 {
        return
    }

    question := msg.Question[0]
    log.Printf("Received query: %s", question.Name)

    resp := s.router(msg, question.Name)
    respData, err := resp.Pack()
    if err != nil {
        log.Printf("Error packing response: %v", err)
        return
    }

    if _, err := conn.WriteToUDP(respData, clientAddr); err != nil {
        log.Printf("Error sending response: %v", err)
    }
}
```

**Watch out for**: `msg.Unpack` doesn't validate the question count. A malformed packet with 0 questions silently passes through — we check `len(msg.Question) == 0` after unpacking. Similarly, `resp.Pack()` can fail if the RR data is corrupt (e.g. unescaped quotes in the TXT string).

#### Router

```go
func (s *Server) router(req *dns.Msg, route string) *dns.Msg {
    resp := new(dns.Msg)
    resp.SetReply(req)

    parts := strings.Split(strings.TrimSuffix(route, "."), ".")

    if len(parts) < 3 || parts[0] != "movie" || parts[1] != "info" {
        txt, _ := dns.NewRR(fmt.Sprintf("%s 3600 IN TXT \"invalid request format\"",
            req.Question[0].Name))
        resp.Answer = append(resp.Answer, txt)
        return resp
    }

    movieName := strings.Join(parts[2:], " ")
    movie, err := s.omdbClient.GetMovieDescription(context.Background(), movieName)

    var answerText string
    if err != nil {
        log.Printf("Error fetching movie: %v", err)
        answerText = fmt.Sprintf("Error: %v", err)
    } else {
        answerText = movie.Description
        if len(answerText) > 250 {
            answerText = answerText[:247] + "..."
        }
    }

    txt, _ := dns.NewRR(fmt.Sprintf("%s 3600 IN TXT \"%s\"",
        req.Question[0].Name,
        strings.ReplaceAll(answerText, "\"", "\\\"")))
    resp.Answer = append(resp.Answer, txt)

    return resp
}
```

**Why split on `.` and not use a proper DNS-aware PTR-style lookup?** The `.` in the query name is used as a makeshift delimiter. Since DNS labels are already dot-separated, parsing `movie.info.the.matrix.` gives `["movie", "info", "the", "matrix"]`. Joining from index 2 reconstructs "the matrix". This is the weakest part of the design — a movie with "Dr." or "Mr." in its title (e.g. "Dr. Strangelove") becomes "Dr Strangelove".

**Why truncate at 250 characters and not 255?** DNS TXT records have a 255-byte limit per single character-string, but the wire format overhead (length byte, quote escaping) can push it over. Truncating at 250 with an ellipsis leaves headroom. If the description is shorter, the full text is returned.

**Quote escaping is critical**: The TXT RDATA format uses quoted strings. If the OMDB plot contains a double quote (e.g. `He said "hello"`), the raw string `"He said "hello""` would be parsed as two separate strings by the DNS library. The `strings.ReplaceAll(answerText, "\"", "\\\"")` escapes quotes before embedding.

### Step 4: Server entry point

File: `cmd/server/main.go`

```go
package main

import (
    "log"

    "github.com/priyanshu360/dig-your-movie/internal/config"
    "github.com/priyanshu360/dig-your-movie/internal/dns"
    "github.com/priyanshu360/dig-your-movie/internal/omdb"
)

func main() {
    cfg := config.Load()

    omdbClient := omdb.NewClient(cfg.APIKey)
    server := dns.NewServer(cfg, omdbClient)

    if err := server.Run(); err != nil {
        log.Fatalf("Server failed: %v", err)
    }
}
```

This is the dependency wiring: load config, create the OMDB client, create the DNS server, and run. No HTTP router, no middleware, no database — just a UDP goroutine loop.

### Step 5: The CLI client

File: `cmd/client/main.go`

```go
package main

import (
    "fmt"
    "log"
    "os"
    "time"

    "github.com/miekg/dns"
)

func main() {
    if len(os.Args) < 2 {
        log.Fatal("Usage: client <movie_name>")
    }

    movieName := os.Args[1]
    dnsName := fmt.Sprintf("movie.info.%s.", movieName)

    c := new(dns.Client)
    c.Timeout = 5 * time.Second
    m := new(dns.Msg)
    m.SetQuestion(dns.Name(dnsName).String(), dns.TypeTXT)

    serverAddr := "localhost:8095"
    if port := os.Getenv("PORT"); port != "" {
        serverAddr = "localhost:" + port
    }

    r, _, err := c.Exchange(m, serverAddr)
    if err != nil {
        log.Fatalf("DNS Query failed: %v", err)
    }

    if r.Rcode != dns.RcodeSuccess {
        log.Fatalf("DNS query failed with Rcode: %d", r.Rcode)
    }

    for _, ans := range r.Answer {
        if txt, ok := ans.(*dns.TXT); ok {
            for _, chunk := range txt.Txt {
                fmt.Println(chunk)
            }
        }
    }
}
```

**Why `dns.Name(dnsName).String()` instead of just `dnsName`?** The `SetQuestion` method expects a fully-qualified domain name. The `dns.Name` type normalizes the string — it appends a trailing dot if missing, lowercases, and handles edge cases. Bypassing it can produce malformed questions.

**Why no space-to-dot replacement in the client?** The current client naively passes the movie name as-is. If you run `go run cmd/client/main.go "The Matrix"`, the query becomes `movie.info.The Matrix.` which contains a space in a label — this is technically invalid per DNS specs but the `miekg/dns` library handles it. The server's split logic reassembles it correctly.

**Why `dns.Client` and not raw UDP like the server?** The client uses `miekg/dns`'s high-level `Client.Exchange` which handles timeouts, retries (for TCP fallback), and response validation. The server uses raw UDP for full control over the read loop.

### Step 6: Running it

Start the server:

```bash
$ go run cmd/server/main.go
2024/01/01 12:00:00 Starting UDP server on :8095
```

Query from another terminal:

```bash
# Using the custom client
$ go run cmd/client/main.go "The Matrix"
Thomas A. Anderson is a man living two lives. By day he is an average computer programmer and by night a hacker known as Neo. Neo has always questioned his reality, but the truth is far beyond his imagination. He finds himself...

# Using dig
$ dig @localhost -p 8095 movie.info.the.matrix. TXT +short
"Thomas A. Anderson is a man living two lives. By day he is an average computer programmer and by night a hacker known as Neo. Neo has always questioned his reality, but the truth is far beyond his imagination. He finds himself..."

# An invalid query
$ dig @localhost -p 8095 foo.bar.baz. TXT +short
"invalid request format"
```

**Watch out for**: The server doesn't handle concurrent queries to the same movie — each request fires an HTTP call to OMDB. If you send 10 queries for "The Matrix" simultaneously, the server launches 10 goroutines, each making an HTTP request. OMDB might rate-limit you. A cache layer (even an in-memory `sync.Map`) would help.

### Step 7: Docker multi-stage build

File: `Dockerfile`

```dockerfile
FROM golang:1.20-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go build -o server cmd/server/main.go

FROM alpine:latest

WORKDIR /app

COPY --from=builder /app/server .

EXPOSE 8095

CMD ["./server"]
```

```bash
$ docker build -t dig-your-movie .
$ docker run -p 8095:8095 dig-your-movie
```

**Why multi-stage?** The final image is ~15MB (Alpine + a static Go binary) vs ~900MB if you kept the Go toolchain. The first stage (`golang:1.20-alpine`) compiles the binary, the second stage (`alpine:latest`) only has the binary and runtime libraries.

**Why only build the server?** The Dockerfile only builds `cmd/server/main.go`. The client is intended to be run locally with `go run` — Docker is just for deploying the DNS server.

### Feature comparison

| Aspect | This project | A "real" DNS server |
|--------|--------------|-------------------|
| Transport | Raw UDP on single socket | UDP + TCP fallback, EDNS0 |
| Routing | `strings.Split` on `.` | Regex or DNS name matching |
| Caching | None (every query hits OMDB) | TTL-based with LRU eviction |
| Concurrency | One goroutine per query | Worker pool with bounded concurrency |
| DNS features | TXT records only | A, AAAA, CNAME, MX, NS, SOA, PTR |
| Security | None (public UDP) | DNSSEC, ACLs, rate limiting |
| Query format | `movie.info.<name>.` | Standard FQDN with zones |

### Gotchas and design trade-offs

1. **No TCP fallback**: Standard DNS servers switch to TCP when the UDP response exceeds 512 bytes (or EDNS0-larger). This server always sends UDP. If the packed response exceeds 512 bytes, it gets silently truncated. The 250-char truncation prevents this in practice.

2. **Dots in movie titles**: The routing scheme breaks for any movie with a dot in its name (e.g. "Dr. No" becomes "Dr No" after re-joining). A more robust approach would URL-encode the movie name in the query and decode on the server side.

3. **No query type filtering**: The router generates TXT records regardless of the query type. If someone sends an A record query for `movie.info.the.matrix.`, they'd get a TXT response. `SetReply` sets the QR bit and copies the question, but doesn't enforce `dns.TypeTXT`.

4. **`dns.NewRR` error ignored**: The router calls `dns.NewRR` with `txt, _ := dns.NewRR(...)`, discarding the error. If the format string is malformed (e.g. unescaped quotes in the answer text), the function returns a nil RR and no error is logged. The `strings.ReplaceAll` escaping should prevent this, but it's a silent failure mode.

5. **Environment variable naming**: The config uses `API_KEY` (not `OMDB_API_KEY` or `APIKEY`). This is easy to forget when deploying. A common convention is `OMDB_API_KEY` for clarity.

### Next steps

- Add in-memory caching with TTL expiration so repeated queries don't hit the OMDB API
- Add an HTTP health check endpoint (a separate goroutine listening on a different port)
- Support EDNS0 for larger UDP payloads
- Implement TCP fallback for responses > 512 bytes
- Use URL encoding for movie names in the domain query to handle dots and spaces

The full source is at [github.com/priyanshu360/dig-your-movie](https://github.com/priyanshu360/dig-your-movie).

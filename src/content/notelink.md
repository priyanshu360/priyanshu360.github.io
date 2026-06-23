## How to Build a Secure Full-Stack Note-Taking App with JWT + MongoDB

In this tutorial, we'll build NoteLink — a full-stack note-taking platform with JWT authentication, full-text search, and persistent storage in MongoDB. By the end you'll have a production-ready app you can deploy with Docker.

### What to expect

```bash
$ curl -X POST localhost:8080/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"secret"}'

{"id":"669a...","username":"alice"}

$ curl -X POST localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"secret"}'

{"user":{"id":"669a...","username":"alice"},"token":"eyJhbGciOiJIUzI1NiIs..."}

$ curl localhost:8080/api/notes \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."

[{"id":"669b...","title":"My Note","content":"hello","user_id":"669a...",...}]
```

### What you'll learn

- Building a REST API with Gorilla Mux and Go's net/http
- Implementing JWT authentication with bcrypt password hashing
- Structuring MongoDB models with the official Go driver
- Building a React + TypeScript frontend with protected routing
- Containerizing everything with Docker Compose

### Prerequisites

- Go 1.21+
- Node.js 18+
- Docker and Docker Compose (for MongoDB)
- Basic knowledge of REST APIs and React

### Project structure

```
NoteLink/
├── main.go                 # Entry point
├── config/
│   └── config.go           # Server config from env vars
├── server/
│   └── server.go           # Router, middleware, HTTP server
├── handlers/
│   ├── handlers.go         # Shared handler helpers (getUserIDFromToken)
│   ├── user_handlers.go    # Signup and login
│   └── note_handlers.go    # CRUD + search + share
├── model/
│   ├── user.go             # User struct + Credentials
│   ├── note.go             # Note struct
│   └── apierror.go         # APIError response type
├── repository/
│   ├── repository.go       # UserStore and NoteStore interfaces
│   └── mongo/
│       ├── user_mongo.go   # MongoDB UserStore implementation
│       └── note_mongo.go   # MongoDB NoteStore implementation
├── service/
│   ├── service.go          # Service interfaces
│   ├── user/
│   │   └── user.go         # Auth logic, JWT generation
│   └── note/
│       └── note.go         # Note business logic
├── utils/
│   ├── validators.go       # JWT validation, ObjectID validation
├── frontend/
│   ├── src/
│   │   ├── components/     # Login, Signup, Notes, Navbar, etc.
│   │   ├── contexts/       # AuthContext, NotesContext
│   │   ├── services/       # Axios API client
│   │   ├── models/         # User, Note types
│   │   ├── types/          # TypeScript definitions
│   │   ├── hooks/          # Custom hooks
│   │   └── utils/          # Helpers
│   ├── public/
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml
├── Dockerfile
├── Makefile
├── go.mod
└── go.sum
```

### Imports

**Go (server side)**

| Package | Why |
|---------|-----|
| `github.com/gorilla/mux` | HTTP router — URL parameters, subrouters, middleware chaining |
| `go.mongodb.org/mongo-driver` | Official MongoDB driver |
| `github.com/golang-jwt/jwt` | JWT creation and validation |
| `golang.org/x/crypto/bcrypt` | Password hashing — never store plaintext |
| `golang.org/x/time/rate` | Rate limiting — per-server token bucket |

**Why these choices?**

- **MongoDB over PostgreSQL**: Notes are schema-flexible (tags can vary per note). MongoDB's text indexes are simpler to set up than PostgreSQL's full-text search (tsvector). Trade-off: MongoDB has weaker transaction guarantees, but for a note-taking app that's fine.

- **JWT over sessions**: Stateless — no server-side session store needed. The token carries the user ID, so any backend instance can verify it without hitting a database. Trade-off: tokens can't be revoked server-side (unless you maintain a blocklist). The actual app mitigates this with a 24-hour expiration.

### Auth and note flow

```mermaid
flowchart TB
    subgraph Client
        R[React App] --> L[Login Form]
        R --> N[Note Editor]
    end
    subgraph Server
        A[POST /api/auth/login] -->|JWT token| L
        MW[Auth Middleware] -->|Validate token| H[Note Handlers]
        H --> CRUD[CRUD Operations]
        CRUD --> M[(MongoDB)]
    end
    S[Rate Limiter: 2 req/s] --> A
    S --> MW
```

### Step 1: Server config from environment

File: `config/config.go`

```go
package config

import (
    "log"
    "os"
    "strconv"
)

type ServerConfig struct {
    address      string
    port         string
    readTimeout  int
    writeTimeout int
}

func NewServerConfig() ServerConfig {
    rTimeout, errR := strconv.Atoi(getEnvWithDefault("READ_TIMEOUT", "5"))
    wTimeout, errW := strconv.Atoi(getEnvWithDefault("WRITE_TIMEOUT", "5"))

    if errR != nil || errW != nil {
        log.Fatal(errR, errW)
    }

    return ServerConfig{
        address:      getEnvWithDefault("SERVER_ADDRESS", "0.0.0.0"),
        port:         getEnvWithDefault("SERVER_PORT", getEnvWithDefault("PORT", "8080")),
        readTimeout:  rTimeout,
        writeTimeout: wTimeout,
    }
}

func getEnvWithDefault(key, defaultValue string) string {
    if value, found := os.LookupEnv(key); found {
        return value
    }
    return defaultValue
}
```

**Why a config struct and not global variables?** The struct is passed explicitly to `NewServer` — no global state, testable, and the caller controls the values. The `getEnvWithDefault` helper falls back to sensible defaults so the app works without a `.env` file during development.

### Step 2: User model

File: `model/user.go`

```go
package model

import "go.mongodb.org/mongodb-driver/bson/primitive"

type User struct {
    ID       primitive.ObjectID `bson:"_id,omitempty" json:"id"`
    Username string             `bson:"username" json:"username"`
    Password string             `bson:"password" json:"-"`
}

type Credentials struct {
    Username string `json:"username"`
    Password string `json:"password"`
}
```

Key design decisions:

- **`json:"-"` on Password**: The password hash is never sent in API responses. Without this tag, every `json.Marshal(user)` would leak the hash. `bson` tags map to MongoDB fields, `json` tags map to HTTP responses.

- **Username as the identifier (not email)**: Simpler for a demo app. The username is unique — we query by `bson.M{"username": username}`. In production you'd want email + username, but that adds verification complexity.

- **No `CreatedAt`/`UpdatedAt` on User**: The real app doesn't track user timestamps. Notes do have timestamps, but the user model is minimal — just ID, username, and password hash.

### Step 3: MongoDB connection

File: `server/server.go` (connection logic is inline, not a separate package)

```go
func connectMongo() (*mongo.Client, string) {
    mongoURL := os.Getenv("MONGODB_URL")
    if mongoURL == "" {
        mongoURL = "mongodb://localhost:27017"
    }

    dbName := os.Getenv("DATABASE_NAME")
    if dbName == "" {
        dbName = "testdb"
    }

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoURL))
    if err != nil {
        log.Fatal("Error connecting to MongoDB: ", err)
    }

    err = client.Ping(ctx, nil)
    if err != nil {
        log.Fatal("Error pinging MongoDB: ", err)
    }

    return client, dbName
}
```

**Watch out for**: `mongo.Connect` is lazy — it returns immediately without actually connecting. Always call `Ping` (inside a timeout context) afterward to catch connection errors at startup, not at the first request.

**Why `10*time.Second` timeout?** If MongoDB isn't running, we want to fail fast — within 10 seconds — rather than hanging indefinitely. The Docker Compose setup starts MongoDB first, but there's still a race condition (see Step 9).

### Step 4: User registration and authentication

File: `handlers/user_handlers.go`

```go
package handlers

import (
    "encoding/json"
    "net/http"

    "github.com/priyanshu360/NoteLink/model"
    "github.com/priyanshu360/NoteLink/service"
    "github.com/priyanshu360/NoteLink/utils"
)

type UserHandler struct {
    userService service.UserService
}

func NewUserHandler(userService service.UserService) *UserHandler {
    return &UserHandler{userService: userService}
}

// POST /api/auth/signup
func (h *UserHandler) CreateUserHandler(w http.ResponseWriter, r *http.Request) {
    var creds model.Credentials
    if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
        utils.WriteJSONError(w, model.NewAPIError(http.StatusBadRequest, err.Error()))
        return
    }

    user := &model.User{Username: creds.Username, Password: creds.Password}
    createdUser, err := h.userService.CreateUser(r.Context(), user)
    if err != nil {
        utils.WriteJSONError(w, model.NewAPIError(http.StatusInternalServerError, err.Error()))
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(createdUser)
}

// POST /api/auth/login
func (h *UserHandler) AuthenticateUserHandler(w http.ResponseWriter, r *http.Request) {
    var creds model.Credentials
    if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
        utils.WriteJSONError(w, model.NewAPIError(http.StatusBadRequest, err.Error()))
        return
    }

    user := model.User{Username: creds.Username, Password: creds.Password}
    response, err := h.userService.AuthenticateUser(r.Context(), user)
    if err != nil {
        utils.WriteJSONError(w, model.NewAPIError(http.StatusUnauthorized, err.Error()))
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}
```

The handler is thin — it decodes the request, calls the service layer, and writes the response. All business logic (password hashing, JWT generation) lives in the service layer.

**Why `json.NewDecoder(r.Body).Decode` and not `ioutil.ReadAll`?** The decoder reads directly from the request body stream — no intermediate buffer. For small payloads like login credentials, both work fine. The decoder also handles `io.EOF` gracefully (empty body → decode error).

#### Password hashing

File: `service/user/user.go`

```go
func (s *UserServiceImpl) HashPassword(password string) (string, error) {
    bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
    return string(bytes), err
}
```

**Why bcrypt and not SHA-256?** bcrypt is deliberately slow (configurable cost factor). A SHA-256 hash can be computed in nanoseconds — an attacker with a GPU can try billions of passwords per second. bcrypt at default cost takes ~100ms per hash, making brute-force impractical.

**Watch out for**: bcrypt truncates passwords at 72 bytes. If you need longer passwords, hash them with SHA-256 first, then bcrypt the result. The `bcrypt.DefaultCost` (10) is a good balance of security and speed — increase to 12+ for production.

#### JWT generation

```go
func (s *UserServiceImpl) generateJWTToken(userID primitive.ObjectID) (string, error) {
    claims := &jwt.StandardClaims{
        Subject:   userID.Hex(),
        ExpiresAt: time.Now().Add(time.Hour * 24).Unix(),
        IssuedAt:  time.Now().Unix(),
    }

    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString([]byte(utils.GetJWTSecret()))
}
```

The login response includes both the user and the token:

```go
type UserLoginResponse struct {
    User  *model.User `json:"user"`
    Token string      `json:"token"`
}
```

**Why single JWT (not access + refresh)?** The actual app uses a single 24-hour token. For a demo app this is fine. In production you'd want a short-lived access token (15 min) + a refresh token (7 days), so a stolen token only grants limited access.

### Step 5: JWT validation middleware

File: `server/server.go`

```go
func AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        tokenString := r.Header.Get("Authorization")
        if tokenString == "" {
            utils.WriteJSONError(w, model.NewAPIError(http.StatusUnauthorized, "Unauthorized"))
            return
        }

        _, err := utils.ValidateJWT(tokenString)
        if err != nil {
            utils.WriteJSONError(w, model.NewAPIError(http.StatusUnauthorized, "Unauthorized"))
            return
        }

        next.ServeHTTP(w, r)
    })
}
```

File: `utils/validators.go`

```go
func ValidateJWT(tokenString string) (*jwt.StandardClaims, error) {
    tokenString = strings.TrimPrefix(tokenString, "Bearer ")

    token, err := jwt.ParseWithClaims(tokenString, &jwt.StandardClaims{}, func(token *jwt.Token) (interface{}, error) {
        return []byte(GetJWTSecret()), nil
    })

    if err != nil {
        return nil, err
    }

    claims, ok := token.Claims.(*jwt.StandardClaims)
    if !ok {
        return nil, errors.New("invalid token claims")
    }

    return claims, nil
}
```

**Why trim "Bearer " prefix?** The `Authorization` header comes as `Bearer <token>`. The JWT library expects just the raw token. `strings.TrimPrefix` is cleaner than splitting on space — it only strips if the prefix matches, so a malformed header without "Bearer " returns an error.

**Watch out for**: The `GetJWTSecret()` function has a hardcoded fallback `"your-secret-key"`. In the original code, this was duplicated three times across the codebase. The refactored version centralized it to one place. Still, never use the default in production — set `JWT_SECRET` in your environment.

### Step 6: Route setup and rate limiting

File: `server/server.go`

```go
var rateLimit = rate.NewLimiter(2, 5)

func (s *APIServer) initRoutesAndMiddleware() {
    // Global rate limiter — applied to every request
    s.router.Use(RateLimitMiddleware)

    // Connect to MongoDB
    client, dbName := connectMongo()

    // Initialize dependency chain: store → service → handler
    initUserStore := func() repository.UserStore {
        return mongo.NewMongoUserRepository(client, dbName, "users")
    }
    initNoteStore := func() repository.NoteStore {
        return mongo.NewMongoNoteStore(client, dbName, "notes")
    }

    userStore := initUserStore()
    userService := user.NewUserService(userStore)
    userHandler := handlers.NewUserHandler(userService)

    // Public routes
    s.router.HandleFunc("/api/auth/signup", userHandler.CreateUserHandler).Methods("POST")
    s.router.HandleFunc("/api/auth/login", userHandler.AuthenticateUserHandler).Methods("POST")

    // Protected routes — require valid JWT
    protectedRouter := s.router.PathPrefix("/api").Subrouter()
    protectedRouter.Use(AuthMiddleware)

    noteStore := initNoteStore()
    noteService := note.NewNoteService(noteStore)
    noteHandler := handlers.NewNoteHandler(noteService, userService)

    protectedRouter.HandleFunc("/notes", noteHandler.GetNotesHandler).Methods("GET")
    protectedRouter.HandleFunc("/notes/{id}", noteHandler.GetNoteHandler).Methods("GET")
    protectedRouter.HandleFunc("/notes", noteHandler.CreateNoteHandler).Methods("POST")
    protectedRouter.HandleFunc("/notes/{id}", noteHandler.UpdateNoteHandler).Methods("PUT")
    protectedRouter.HandleFunc("/notes/{id}", noteHandler.DeleteNoteHandler).Methods("DELETE")
    protectedRouter.HandleFunc("/notes/{id}/share", noteHandler.ShareNoteHandler).Methods("POST")
    protectedRouter.HandleFunc("/search", noteHandler.SearchNotesHandler).Methods("GET")

    s.httpServer.Handler = s.router
}
```

**Rate limiter**: Uses `golang.org/x/time/rate` — a token bucket limiter. `rate.NewLimiter(2, 5)` allows bursts of up to 5 requests, then sustains at 2 requests/second. Every request consumes a token; if the bucket is empty, the response is 429 Too Many Requests.

```go
func RateLimitMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if !rateLimit.Allow() {
            utils.WriteJSONError(w, model.NewAPIError(http.StatusTooManyRequests, "Rate limit exceeded"))
            return
        }
        next.ServeHTTP(w, r)
    })
}
```

**Why per-server rate limiting and not per-user?** `rate.NewLimiter` with a global variable is simple but applies to all users combined. A single user with a script can exhaust the limit for everyone. Per-user limiting (keyed by IP or JWT subject) is better for production.

### Step 7: Notes CRUD

File: `model/note.go`

```go
package model

import (
    "time"
    "go.mongodb.org/mongodb-driver/bson/primitive"
)

type Note struct {
    ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
    UserID    primitive.ObjectID `bson:"user_id" json:"user_id"`
    Title     string             `bson:"title" json:"title"`
    Content   string             `bson:"content" json:"content"`
    SharedWith []string          `bson:"shared_with,omitempty" json:"shared_with,omitempty"`
    CreatedAt time.Time          `bson:"created_at" json:"created_at"`
    UpdatedAt time.Time          `bson:"updated_at" json:"updated_at"`
}
```

The create handler extracts the user ID from the JWT claims:

```go
func (h *NoteHandler) CreateNoteHandler(w http.ResponseWriter, r *http.Request) {
    userID, err := getUserIDFromToken(r)
    if err != nil {
        utils.WriteJSONError(w, model.NewAPIError(http.StatusUnauthorized, "Unauthorized"))
        return
    }

    var note model.Note
    if err := json.NewDecoder(r.Body).Decode(&note); err != nil {
        utils.WriteJSONError(w, model.NewAPIError(http.StatusBadRequest, err.Error()))
        return
    }

    note.UserID = userID
    err = h.noteService.CreateNote(r.Context(), &note)
    if err != nil {
        utils.WriteJSONError(w, model.NewAPIError(http.StatusInternalServerError, err.Error()))
        return
    }

    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(note)
}
```

**How `getUserIDFromToken` works**: It re-parses the JWT from the Authorization header, extracts the `Subject` claim (which is the user's ObjectID hex), and converts it back to `primitive.ObjectID`. This is redundant (the middleware already validated the token) but keeps handlers self-contained.

#### Text search with MongoDB indexes

```go
func (h *NoteHandler) SearchNotesHandler(w http.ResponseWriter, r *http.Request) {
    userID, err := getUserIDFromToken(r)
    if err != nil {
        utils.WriteJSONError(w, model.NewAPIError(http.StatusUnauthorized, "Unauthorized"))
        return
    }

    query := r.URL.Query().Get("q")
    if query == "" {
        utils.WriteJSONError(w, model.NewAPIError(http.StatusBadRequest, "Query parameter 'q' is required"))
        return
    }

    notes, err := h.noteService.SearchNotes(r.Context(), userID, query)
    // ...
}
```

The search query looks like:
```
GET /api/search?q=golang
```

MongoDB's `$text` search is case-insensitive and supports stemming. Create the text index on title and content:

```javascript
db.notes.createIndex({ title: "text", content: "text" })
```

### Step 8: React frontend

File: `frontend/src/services/api.ts`

```tsx
import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8080',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

File: `frontend/src/components/ProtectedRoute.tsx`

```tsx
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}
```

**Why localStorage and not httpOnly cookies?** 

Simpler for a tutorial. In production, httpOnly cookies are safer (not accessible to JavaScript, immune to XSS). The trade-off is you need CSRF protection.

### Step 9: Docker Compose

File: `docker-compose.yml`

```yaml
services:
  mongodb:
    image: mongo:6.0
    container_name: notelink-mongodb
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password123
      MONGO_INITDB_DATABASE: notelink
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

  backend:
    build: .
    container_name: notelink-backend
    restart: unless-stopped
    environment:
      MONGODB_URL: mongodb://admin:password123@mongodb:27017/notelink?authSource=admin
      DATABASE_NAME: notelink
      JWT_SECRET: dev-secret-change-in-production
      PORT: "8080"
    ports:
      - "8080:8080"
    depends_on:
      - mongodb

volumes:
  mongodb_data:
```

**Why MongoDB with authentication?** 

The `MONGO_INITDB_ROOT_USERNAME` and `MONGO_INITDB_ROOT_PASSWORD` environment variables set up a root user on first run. The backend connects using `mongodb://admin:password123@mongodb:27017/notelink?authSource=admin`.

**Watch out for**: `depends_on` only waits for the container to start, not for MongoDB to be ready. MongoDB takes a few seconds to initialize. The Go server will crash on first startup because `connectMongo` calls `log.Fatal` on failure. Add retry logic for production:

```go
func connectMongoWithRetry(uri string, retries int) (*mongo.Client, string) {
    for i := 0; i < retries; i++ {
        ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
        client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
        if err == nil {
            if err = client.Ping(ctx, nil); err == nil {
                cancel()
                return client, "notelink"
            }
        }
        cancel()
        time.Sleep(time.Second * time.Duration(i+1))
    }
    log.Fatal("Failed to connect to MongoDB after retries")
    return nil, ""
}
```

The full source is at [github.com/priyanshu360/NoteLink](https://github.com/priyanshu360/NoteLink).

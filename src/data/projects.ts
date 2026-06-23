export interface Project {
  slug: string
  name: string
  description: string
  language: string
  githubUrl: string
  techStack: { category: string; items: string[] }[]
  year: number
}

export const projects: Project[] = [
  {
    slug: 'notelink',
    name: 'NoteLink',
    description: 'Secure full-stack note management platform with JWT auth, MongoDB, real-time search, and Docker deployment.',
    language: 'TypeScript',
    githubUrl: 'https://github.com/priyanshu360/NoteLink',
    year: 2026,
    techStack: [
      { category: 'Backend', items: ['Go 1.21', 'Gorilla Mux', 'MongoDB 6.0'] },
      { category: 'Frontend', items: ['React', 'TypeScript'] },
      { category: 'Infrastructure', items: ['Docker', 'Nginx', 'GitHub Actions', 'Prometheus', 'Grafana'] },
      { category: 'Security', items: ['JWT', 'bcrypt', 'CORS', 'Rate Limiting'] },
    ],
  },
  {
    slug: 'shell-rust',
    name: 'Shell (Rust)',
    description: 'A minimal POSIX-compliant shell with builtins, tab completion, and I/O redirection built from scratch in Rust.',
    language: 'Rust',
    githubUrl: 'https://github.com/priyanshu360/shell-rust',
    year: 2026,
    techStack: [
      { category: 'Language', items: ['Rust'] },
      { category: 'REPL', items: ['rustyline'] },
      { category: 'Protocol', items: ['POSIX'] },
    ],
  },

  {
    slug: 'aigen',
    name: 'Aigen',
    description: 'Build-time TypeScript function generator using LLM — write call sites first, generate implementations during build.',
    language: 'TypeScript',
    githubUrl: 'https://github.com/priyanshu360/aigen',
    year: 2026,
    techStack: [
      { category: 'Runtime', items: ['TypeScript', 'Node.js'] },
      { category: 'Build', items: ['Vite', 'esbuild', 'tsc'] },
      { category: 'LLM', items: ['Anthropic API', 'aigen-agent'] },
    ],
  },
  {
    slug: 'bittorrent-client',
    name: 'BitTorrent Client',
    description: 'Full BitTorrent protocol client with TUI, DHT peer discovery, magnet links, and UPnP — written in Go.',
    language: 'Go',
    githubUrl: 'https://github.com/priyanshu360/bittorrent-client',
    year: 2026,
    techStack: [
      { category: 'Language', items: ['Go'] },
      { category: 'Protocol', items: ['BitTorrent', 'DHT (Kademlia)', 'UPnP IGD'] },
      { category: 'UI', items: ['Terminal UI', 'BubbleTea'] },
    ],
  },
  {
    slug: 'chatbot-llm',
    name: 'Chatbot LLM',
    description: 'Multi-provider LLM chat with SSE streaming, Redis stream ingestion, PostgreSQL analytics, and Kubernetes deployment.',
    language: 'Go',
    githubUrl: 'https://github.com/priyanshu360/chatbot-llm',
    year: 2026,
    techStack: [
      { category: 'Backend', items: ['Go', 'Redis Streams', 'SSE', 'PostgreSQL'] },
      { category: 'Frontend', items: ['React', 'TypeScript', 'Tailwind CSS'] },
      { category: 'Infrastructure', items: ['Kubernetes', 'KinD', 'Docker', 'Grafana'] },
    ],
  },
  {
    slug: 'blockexplorer',
    name: 'Ethereum Block Explorer',
    description: 'Ethereum blockchain explorer using ethers.js and Alchemy — view blocks, transactions, and account balances.',
    language: 'JavaScript',
    githubUrl: 'https://github.com/priyanshu360/blockexplorer',
    year: 2026,
    techStack: [
      { category: 'Language', items: ['JavaScript'] },
      { category: 'Frontend', items: ['React', 'ethers.js', 'Tailwind CSS'] },
      { category: 'Blockchain', items: ['Ethereum', 'Alchemy'] },
    ],
  },

  {
    slug: 'dig-your-movie',
    name: 'Dig Your Movie',
    description: 'DNS-based movie information retrieval — encode OMDB movie data into DNS TXT responses. A pun on the dig tool.',
    language: 'Go',
    githubUrl: 'https://github.com/priyanshu360/dig-your-movie',
    year: 2026,
    techStack: [
      { category: 'Language', items: ['Go'] },
      { category: 'Protocol', items: ['DNS'] },
      { category: 'API', items: ['OMDB'] },
    ],
  },
  {
    slug: 'kafka-graceful-failure',
    name: 'Kafka Graceful Failure Strategy',
    description: 'POC demonstrating a dead letter topic pattern for Kafka — poison pill messages get routed to a DLQ instead of blocking the consumer.',
    language: 'Go',
    githubUrl: 'https://github.com/priyanshu360/Kafka-Gracefully-Failure-Strategy',
    year: 2023,
    techStack: [
      { category: 'Language', items: ['Go'] },
      { category: 'Message Queue', items: ['Kafka'] },
    ],
  },
  {
    slug: 'speedcode',
    name: 'Speedcode',
    description: 'Terminal typing tutor that teaches TypeScript through progressive lessons with inline explanations.',
    language: 'TypeScript',
    githubUrl: 'https://github.com/priyanshu360/speedcode',
    year: 2026,
    techStack: [
      { category: 'Language', items: ['TypeScript'] },
      { category: 'Runtime', items: ['Node.js'] },
      { category: 'UI', items: ['Terminal UI'] },
    ],
  },
  {
    slug: 'ultimate-tic-tac-toe',
    name: 'Ultimate Tic-Tac-Toe',
    description: 'Ultimate Tic-Tac-Toe with a minimax AI opponent. Built with Next.js 16, React 19, Tailwind CSS v4.',
    language: 'TypeScript',
    githubUrl: 'https://github.com/priyanshu360/ultimate-tic-tac-toe',
    year: 2026,
    techStack: [
      { category: 'Language', items: ['TypeScript'] },
      { category: 'Frontend', items: ['Next.js 16', 'React 19', 'Tailwind CSS v4'] },
      { category: 'AI', items: ['Minimax Algorithm', 'Alpha-Beta Pruning'] },
    ],
  },
]

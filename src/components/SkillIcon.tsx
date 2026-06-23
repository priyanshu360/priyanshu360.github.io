import type { IconType } from 'react-icons'
import { FaGolang } from 'react-icons/fa6'
import { FaRust, FaReact, FaHtml5, FaDocker, FaAws, FaHardHat } from 'react-icons/fa'
import { IoLogoJavascript } from 'react-icons/io'
import { BsTypescript } from 'react-icons/bs'
import {
  SiSolidity, SiMongodb, SiApachekafka, SiNextdotjs, SiHtmx, SiNginx,
  SiGraphql, SiKubernetes, SiPrometheus, SiGrafana, SiEthereum,
  SiWeb3Dotjs, SiEthers, SiLangchain, SiLanggraph, SiGithubactions, SiAlchemy,
} from 'react-icons/si'
import { RiTailwindCssFill } from 'react-icons/ri'
import { DiRedis } from 'react-icons/di'
import { BiLogoPostgresql } from 'react-icons/bi'
import { TbTerminal, TbSearch } from 'react-icons/tb'
import { PiBrain } from 'react-icons/pi'

const iconMap: Record<string, { icon: IconType; color: string }> = {
  Go: { icon: FaGolang, color: '#00ADD8' },
  TypeScript: { icon: BsTypescript, color: '#3178C6' },
  JavaScript: { icon: IoLogoJavascript, color: '#F7DF1E' },
  Rust: { icon: FaRust, color: '#DEA584' },
  Solidity: { icon: SiSolidity, color: '#363636' },
  React: { icon: FaReact, color: '#61DAFB' },
  'Next.js': { icon: SiNextdotjs, color: '#000000' },
  'Tailwind CSS': { icon: RiTailwindCssFill, color: '#06B6D4' },
  'HTML/CSS': { icon: FaHtml5, color: '#E34F26' },
  HTMX: { icon: SiHtmx, color: '#3366CC' },
  'Terminal UI': { icon: TbTerminal, color: '#50FA7B' },
  Kafka: { icon: SiApachekafka, color: '#231F20' },
  Redis: { icon: DiRedis, color: '#FF4438' },
  PostgreSQL: { icon: BiLogoPostgresql, color: '#4169E1' },
  MongoDB: { icon: SiMongodb, color: '#47A248' },
  GraphQL: { icon: SiGraphql, color: '#E10098' },
  Nginx: { icon: SiNginx, color: '#269539' },
  Kubernetes: { icon: SiKubernetes, color: '#326CE5' },
  Docker: { icon: FaDocker, color: '#2496ED' },
  'GitHub Actions': { icon: SiGithubactions, color: '#2088FF' },
  Prometheus: { icon: SiPrometheus, color: '#E6522C' },
  Grafana: { icon: SiGrafana, color: '#F46800' },
  AWS: { icon: FaAws, color: '#FF9900' },
  'LLM Agents': { icon: PiBrain, color: '#7C3AED' },
  RAG: { icon: TbSearch, color: '#F59E0B' },
  LangChain: { icon: SiLangchain, color: '#1C3C3C' },
  LangGraph: { icon: SiLanggraph, color: '#1C3C3C' },
  Ethereum: { icon: SiEthereum, color: '#627EEA' },
  Web3: { icon: SiWeb3Dotjs, color: '#F7931A' },
  Hardhat: { icon: FaHardHat, color: '#FFF100' },
  Alchemy: { icon: SiAlchemy, color: '#0C0C0E' },
  'ethers.js': { icon: SiEthers, color: '#2535A0' },
}

function DefaultIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5" fill={color} opacity="0.6" />
    </svg>
  )
}

export function SkillIcon({ name }: { name: string }) {
  const entry = iconMap[name]
  if (!entry) {
    const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const hue = hash % 360
    return <DefaultIcon color={`hsl(${hue}, 50%, 55%)`} />
  }

  const Icon = entry.icon
  return <Icon size={14} color={entry.color} />
}

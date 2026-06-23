import { useRevealAnimation } from '../hooks/useRevealAnimation'
import { SkillIcon } from './SkillIcon'

const skills = [
  { category: 'Languages', items: ['Go', 'TypeScript', 'JavaScript', 'Rust', 'Solidity'] },
  { category: 'Frontend', items: ['React', 'Next.js', 'Tailwind CSS', 'HTML/CSS', 'HTMX', 'Terminal UI'] },
  { category: 'Backend', items: ['Kafka', 'Redis', 'PostgreSQL', 'MongoDB', 'GraphQL', 'Nginx'] },
  { category: 'Infrastructure', items: ['Kubernetes', 'Docker', 'GitHub Actions', 'Prometheus', 'Grafana', 'AWS'] },
  { category: 'AI/LLM', items: ['LLM Agents', 'RAG', 'LangChain', 'LangGraph'] },
  { category: 'Blockchain', items: ['Ethereum', 'Web3', 'Hardhat', 'Alchemy', 'ethers.js'] },
]

export function Skills() {
  const ref = useRevealAnimation<HTMLElement>({
    selector: '> div',
    staggerDelay: 80,
  })

  return (
    <section id="skills" ref={ref} className="w-full mb-8">
      <h1 className="text-3xl font-bold ">Skills</h1>
      {skills.map((group) => (
        <div key={group.category} className="mb-4">
          <h4 className="m-0 mb-1 text-sm text-content-muted">
            {group.category}
          </h4>
          <ul className="list-none p-0 flex flex-wrap gap-2">
            {group.items.map((skill) => (
              <li key={skill} className="inline-flex items-center gap-1.5 px-[10px] py-1 rounded bg-surface-3 border border-surface-4 text-sm">
                <SkillIcon name={skill} />
                {skill}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

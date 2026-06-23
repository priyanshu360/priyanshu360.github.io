import { useState } from 'react'
import { Link } from 'react-router-dom'
import { projects, type Project } from '../data/projects'
import { useRevealAnimation } from '../hooks/useRevealAnimation'

const INITIAL_COUNT = 10

const languageColors: Record<string, string> = {
  TypeScript: '#3178c6',
  Go: '#00add8',
  Rust: '#dea584',
  JavaScript: '#f7df1e',
}

function ProjectRow({ project }: { project: Project }) {
  const color = languageColors[project.language] || '#888'
  return (
    <tr className="transition-[background] duration-200 hover:bg-accent-subtle even:bg-white/[0.02]">
      <td className="p-[0.8rem_1rem] text-sm">
        <div className="flex flex-col">
          <Link to={`/projects/${project.slug}`}>{project.name}</Link>
          <span className="text-xs text-content-muted mt-[0.2rem]">{project.year}</span>
        </div>
      </td>
      <td className="tags-col p-[0.8rem_1rem] text-sm hidden sm:table-cell">
        <span className="px-2 py-0.5 rounded-[3px] bg-surface-3 border-2 border-surface-4 inline-block text-xs font-semibold" style={{ borderColor: color, color }}>{project.language}</span>
      </td>
      <td className="p-[0.8rem_1rem] text-sm">{project.description}</td>
    </tr>
  )
}

export function ProjectTable() {
  const [showAll, setShowAll] = useState(false)
  const displayed = showAll ? projects : projects.slice(0, INITIAL_COUNT)
  const ref = useRevealAnimation<HTMLElement>({
    selector: 'tbody tr',
    staggerDelay: 60,
  })

  return (
    <section id="projects" ref={ref} className="w-full mb-8">
      <h1 className="text-3xl font-bold ">Projects</h1>
      <p> Projects on this website are written in a blog format, focusing on the project from my perspective. The Github documentation (if attached) is more technical and documentational than this.
      </p>
      <table className="w-full border-spacing-0 bg-surface-2 rounded-xl my-4 overflow-hidden">
        <thead>
          <tr>
            <th className="bg-surface-3 font-semibold text-left p-4 text-base border-b border-surface-4">Name</th>
            <th className="tags-col bg-surface-3 font-semibold text-left p-4 text-base border-b border-surface-4 hidden sm:table-cell">Language</th>
            <th className="bg-surface-3 font-semibold text-left p-4 text-base border-b border-surface-4">Description</th>
          </tr>
        </thead>
        <tbody>
          {displayed.map((p) => (
            <ProjectRow key={p.slug} project={p} />
          ))}
        </tbody>
      </table>
      {!showAll && projects.length > INITIAL_COUNT && (
        <button
          className="bg-none border border-surface-4 text-content px-[1.2rem] py-[0.6rem] rounded-md cursor-pointer font-space text-sm mt-2 transition-[border-color] duration-200 hover:border-accent hover:text-accent"
          onClick={() => setShowAll(true)}
        >
          View More &rarr;
        </button>
      )}
    </section>
  )
}

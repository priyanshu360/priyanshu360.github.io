import { useParams, Link } from 'react-router-dom'
import { projects } from '../data/projects'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx'
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go'
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml'
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql'
import graphql from 'react-syntax-highlighter/dist/esm/languages/prism/graphql'
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash'
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css'
import { Mermaid } from '../components/Mermaid'
import { useEffect, useState } from 'react'

SyntaxHighlighter.registerLanguage('tsx', tsx)
SyntaxHighlighter.registerLanguage('typescript', typescript)
SyntaxHighlighter.registerLanguage('ts', typescript)
SyntaxHighlighter.registerLanguage('go', go)
SyntaxHighlighter.registerLanguage('rust', rust)
SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('yaml', yaml)
SyntaxHighlighter.registerLanguage('yml', yaml)
SyntaxHighlighter.registerLanguage('sql', sql)
SyntaxHighlighter.registerLanguage('graphql', graphql)
SyntaxHighlighter.registerLanguage('bash', bash)
SyntaxHighlighter.registerLanguage('sh', bash)
SyntaxHighlighter.registerLanguage('css', css)

const languageColors: Record<string, string> = {
  TypeScript: '#3178c6',
  Go: '#00add8',
  Rust: '#dea584',
  JavaScript: '#f7df1e',
}

export function ProjectDetail() {
  const { slug } = useParams()
  const project = projects.find((p) => p.slug === slug)
  const [content, setContent] = useState('')

  useEffect(() => {
    if (!project) return
    import(`../content/${project.slug}.md?raw`).then((mod) => setContent(mod.default)).catch(() => setContent(''))
  }, [project])

  if (!project) {
    return (
      <main className="w-full max-w-[800px] flex flex-col px-4">
        <section className="my-8">
          <h1>Project not found</h1>
          <p><Link to="/">&larr; Back home</Link></p>
        </section>
      </main>
    )
  }

  const color = languageColors[project.language] || '#888'

  return (
      <main className="w-full max-w-[800px] flex flex-col px-4">
      <article className="w-full">
        <header className="mb-8">
          <p className="mb-2 text-sm"><Link to="/">&larr; Home</Link></p>
          <h1>{project.name}</h1>
          <div className="flex items-center gap-4 my-4">
            <span className="px-2 py-0.5 rounded-[3px] bg-surface-3 border-2 border-surface-4 inline-block text-xs font-semibold" style={{ borderColor: color, color }}>
              {project.language}
            </span>
            <span className="text-xs text-content-muted">{project.year}</span>
            <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" className="text-sm">
              View on GitHub &rarr;
            </a>
          </div>
        </header>

        <section className="blog-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const isMermaid = String(className).includes('language-mermaid')
                if (isMermaid) {
                  return <Mermaid chart={String(children)} />
                }
                const match = /language-(\w+)/.exec(String(className))
                if (match) {
                  return (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{
                        // margin: '1rem 0',
                        // borderRadius: '8px',
                        fontSize: '0.85rem',
                        background: '#1e1e1e',
                      }}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  )
                }
                return <code className={className} {...props}>{children}</code>
              },
              pre({ children }) {
                return <pre className="overflow-x-auto text-sm">{children}</pre>
              },
              table({ children }) {
                return <div className="overflow-x-auto"><table>{children}</table></div>
              },
              a({ href, children }) {
                return <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline">{children}</a>
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-4">Tech Stack</h2>
          {project.techStack.map((group) => (
            <div key={group.category} className="mb-4">
              <h4 className="m-0 mb-1 text-sm text-content-muted">{group.category}</h4>
              <ul className="list-none p-0 flex flex-wrap gap-2">
                {group.items.map((item) => (
                  <li key={item} className="px-[10px] py-1 rounded bg-surface-3 border border-surface-4 text-sm">{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </article>
    </main>
  )
}

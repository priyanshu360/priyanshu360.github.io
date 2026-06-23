import { useParams, Link } from 'react-router-dom'
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
import { jobs } from '../data/jobs'

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

export function WorkProjectDetail() {
  const { slug } = useParams()
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')

  useEffect(() => {
    if (!slug) return
    import(`../content/work/${slug}.md?raw`).then((mod) => setContent(mod.default)).catch(() => setContent(''))
    for (const job of jobs) {
      for (const pos of job.positions) {
        for (const h of pos.highlights) {
          if (h.blogSlug === slug) {
            const match = h.text.match(/^[A-Z][^.]*/)
            setTitle(match ? match[0] : slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
            return
          }
        }
      }
    }
    setTitle(slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
  }, [slug])

  if (!slug || !content) {
    return (
      <main className="w-full max-w-[800px] flex flex-col">
        <section className="my-8">
          <h1>Project not found</h1>
          <p><Link to="/#work">&larr; Back to work history</Link></p>
        </section>
      </main>
    )
  }

  return (
    <main className="w-full max-w-[800px] flex flex-col">
      <article className="w-full">
        <header className="mb-8">
          <p className="mb-2 text-sm"><Link to="/#work">&larr; Work History</Link></p>
          <h1>{title}</h1>
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
                        margin: '1rem 0',
                        borderRadius: '8px',
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
                return <pre className="bg-surface-3 border border-surface-4 rounded-lg p-4 overflow-x-auto text-sm leading-relaxed">{children}</pre>
              },
              a({ href, children }) {
                return <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline">{children}</a>
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </section>
      </article>
    </main>
  )
}

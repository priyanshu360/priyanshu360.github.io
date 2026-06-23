import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#1e293b',
    primaryTextColor: '#e2e8f0',
    primaryBorderColor: '#334155',
    lineColor: '#64748b',
    secondaryColor: '#0f172a',
    tertiaryColor: '#1e293b',
  },
})

let idCounter = 0

export function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const idRef = useRef(`mermaid-${++idCounter}`)

  useEffect(() => {
    let cancelled = false
    const id = idRef.current
    mermaid.render(id, chart, ref.current ?? undefined).then(({ svg }) => {
      if (!cancelled && ref.current) {
        ref.current.innerHTML = svg
      }
    }).catch((err) => {
      console.error('Mermaid error:', err)
      const msg = err?.message || (err instanceof Error ? err.message : JSON.stringify(err))
      if (!cancelled) setError(msg)
    })
    return () => { cancelled = true }
  }, [chart])

  return (
    <div className="my-4">
      <div className="mermaid" ref={ref} />
      {error && (
        <div className="border border-red-500 rounded p-3 mt-2 text-red-400 text-xs">
          <p className="font-bold">Mermaid error:</p>
          <pre className="whitespace-pre-wrap">{error}</pre>
        </div>
      )}
    </div>
  )
}

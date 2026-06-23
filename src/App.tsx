import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { Home } from './pages/Home'

const ProjectDetail = lazy(() => import('./pages/ProjectDetail').then(m => ({ default: m.ProjectDetail })))
const WorkProjectDetail = lazy(() => import('./pages/WorkProjectDetail').then(m => ({ default: m.WorkProjectDetail })))

function Loading() {
  return <main className="w-full max-w-200 flex flex-col px-4 my-8"><p className="text-content-muted">Loading...</p></main>
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects/:slug" element={<ProjectDetail />} />
          <Route path="/projects/work/:slug" element={<WorkProjectDetail />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App

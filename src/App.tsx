import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { ProjectDetail } from './pages/ProjectDetail'
import { WorkProjectDetail } from './pages/WorkProjectDetail'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/projects/:slug" element={<ProjectDetail />} />
        <Route path="/projects/work/:slug" element={<WorkProjectDetail />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

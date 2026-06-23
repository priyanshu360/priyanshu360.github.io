import { Header } from '../components/Header'
import { WorkExperience } from '../components/WorkExperience'
import { ProjectTable } from '../components/ProjectTable'
import { Skills } from '../components/Skills'
import { Contact } from '../components/Contact'
import { Links } from '../components/Links'
import { Footer } from '../components/Footer'

export function Home() {
  return (
    <>
      <main className="w-full max-w-200 flex flex-col px-4">
        <Header />
        <ProjectTable />
        <WorkExperience />
        <Skills />
        <Contact />
        <Links />
      </main>
      <Footer />
    </>
  )
}

import { Link } from 'react-router-dom'
import { jobs } from '../data/jobs'
import { useRevealAnimation } from '../hooks/useRevealAnimation'
import { LuFileText } from 'react-icons/lu'

const logos: Record<string, string> = {
  'Stealth Startup': '/logos/stealth.png',
  Finbox: '/logos/finbox.svg',
  'Junglee Games': '/logos/junglee.png',
  Juspay: '/logos/juspay.png',
}

export function WorkExperience() {
  const ref = useRevealAnimation<HTMLElement>({
    selector: '.job-employer',
    staggerDelay: 120,
    duration: 500,
  })

  return (
    <section id="work" ref={ref} className="w-full mb-8">
      <h1 className="text-3xl font-extrabold">Work History</h1>
      <div className="flex flex-wrap items-center gap-8 py-4">
        {jobs.map((job) => (
          <div
            key={job.company}
            className="h-20 w-20  flex items-center gap-16 justify-center"
            title={job.company}
          >
            {logos[job.company] ? (
              <img
                src={logos[job.company]}
                alt={job.company}
                loading="lazy"
                className="h-full max-w-full opacity-50 object-contain grayscale transition-all duration-200 hover:opacity-85 hover:grayscale-0"
              />
            ) : (
              <div
                role="img"
                aria-label={job.company}
                className="w-10 h-10 rounded-full border-2 border-accent flex items-center justify-center font-bold text-base text-accent opacity-70 transition-opacity duration-200 hover:opacity-100"
              >
                {job.company[0]}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-6 ml-2 pl-6 border-l-2 border-surface-4">
        {jobs.map((employer) => (
          <article
            key={employer.company}
            className="job-employer relative mb-8 last:mb-0 before:content-[''] before:absolute before:-left-7.5 before:top-[0.4rem] before:w-2.5 before:h-2.5 before:box-border before:bg-surface before:border-2 before:border-accent before:rounded-full"
          >
            <h4 className="mt-0 mb-1 text-[1.35rem] font-bold">{employer.company}</h4>
            <div className="flex flex-col gap-5">
              {employer.positions.map((position) => (
                <div
                  key={position.title}
                  className="pb-5 border-b border-surface-4 last:pb-0 last:border-b-0"
                >
                  <h5 className="m-0 mb-1.05 text-[1rem] font-semibold">
                    {position.title}
                  </h5>
                  <p className="m-0 mb-2 text-content-muted text-xs">
                    <time>{position.dates}</time>
                  </p>
                  <ul className="m-0 pl-5 text-sm leading-[1.45] list-disc">
                    {position.highlights.map((h, i) => (
                      <li key={i} className="mb-[0.35rem] last:mb-0">
                        {h.text}
                        {h.blogSlug && (
                          <Link to={`/projects/work/${h.blogSlug}`} className="inline-flex items-center ml-1.5 align-middle text-accent hover:text-accent/80 transition-colors" title="Read blog post">
                            <LuFileText size={13} />
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

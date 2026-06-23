import { useRevealAnimation } from '../hooks/useRevealAnimation'
import { LuMail, LuPhone, LuMapPin } from 'react-icons/lu'

export function Contact() {
  const ref = useRevealAnimation<HTMLElement>({
    selector: '> div',
    staggerDelay: 80,
  })

  return (
    <section id="contact" ref={ref} className="w-full mb-8">
      <h1 className="text-3xl font-bold">Get in Touch</h1>
      <p className="text-sm text-content-muted my-2">
        Have a question or want to collaborate? Feel free to reach out.
      </p>
      <div className="flex flex-col gap-2">
        <a
          href="mailto:priyanshurajput360@gmail.com"
          className="flex items-center gap-2 text-sm text-accent hover:underline w-fit"
        >
          <LuMail size={16} />
          priyanshurajput360@gmail.com
        </a>
        <a
          href="tel:+919315848575"
          className="flex items-center gap-2 text-sm text-accent hover:underline w-fit"
        >
          <LuPhone size={16} />
          +91-9315848575
        </a>
        <div className="flex items-center gap-2 text-sm text-content-muted">
          <LuMapPin size={16} />
          India
        </div>
      </div>
    </section>
  )
}

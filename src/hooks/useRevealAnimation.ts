import { useEffect, useRef } from 'react'
import { animate, stagger } from 'animejs'
import type { StaggerParams } from 'animejs'

type Options = {
  selector?: string
  delay?: number
  staggerDelay?: number
  duration?: number
  easing?: string
  from?: StaggerParams['from']
}

export function useRevealAnimation<T extends HTMLElement>({
  selector = '> *',
  delay: delayVal = 0,
  staggerDelay = 50,
  duration = 600,
  easing = 'easeOutQuad',
  from,
}: Options = {}) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const qs = /^[>+~]/.test(selector) ? `:scope ${selector}` : selector
    const targets = el.querySelectorAll<HTMLElement>(qs)
    if (!targets.length) return

    targets.forEach(t => t.classList.add('reveal-child'))

    let played = false

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !played) {
          played = true
          animate(targets, {
            opacity: [0, 1],
            delay: stagger(staggerDelay, { start: delayVal, from }),
            duration,
            ease: easing,
          })
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [selector, delayVal, staggerDelay, duration, easing])

  return ref
}

export interface Job {
  company: string
  logo?: string
  positions: {
    title: string
    dates: string
    highlights: { text: string; blogSlug?: string }[]
  }[]
}

export const jobs: Job[] = [
  {
    company: 'Stealth Startup',
    positions: [
      {
        title: 'Founder / Founding Engineer',
        dates: 'Mar 2025 – Present',
        highlights: [
          { text: 'Building an AI-powered adaptive learning platform in a 0→1 startup, owning product, backend, frontend, and infrastructure end-to-end.' },
          { text: 'Designing and implementing Go-based backend services using PostgreSQL and Redis, focused on scalability and clean architecture.' },
          { text: 'Shipping REST APIs, internal tooling, and React dashboards, while driving MVP execution and the technical roadmap.' },
          { text: 'Setting up cloud infrastructure and CI/CD deployments, handling multiple environments, observability, and production readiness.' },
        ],
      },
    ],
  },
  {
    company: 'Finbox',
    positions: [
      {
        title: 'Senior Software Engineer',
        dates: 'Jul 2024 – Mar 2025',
        highlights: [
          { text: 'Led a team of 3 engineers to build an enterprise-grade maker-checker approval system using Go and Kafka, supporting 15+ financial workflows.', blogSlug: 'maker-checker-approval' },
          { text: 'Designed Jira-like task trays with dynamic state transitions, assignment queues, and RBAC-based approval flows.' },
          { text: 'Implemented a Kafka-backed immutable audit trail system, eliminating unauthorized changes and improving regulatory compliance by 90%.', blogSlug: 'audit-trail-system' },
          { text: 'Built a configurable Business Rule Engine with a custom DSL, enabling non-technical users to author and manage rules dynamically.', blogSlug: 'business-rule-engine' },
          { text: 'Led the migration of 35+ REST APIs to GraphQL, achieving a 45% latency reduction and 40% increase in developer productivity.' },
        ],
      },
    ],
  },
  {
    company: 'Junglee Games',
    positions: [
      {
        title: 'Software Engineer',
        dates: 'Apr 2023 – Jul 2024',
        highlights: [
          { text: 'Developed an escrow microservice for managing in-game currency, functioning as a virtual wallet for secure transactions with ACID compliance.', blogSlug: 'escrow-system' },
          { text: 'Collaborated on the Rumble/Tournament microservice for a poker game, enhancing game functionality and user engagement.' },
        ],
      },
    ],
  },
  {
    company: 'Juspay',
    positions: [
      {
        title: 'Associate Software Developer',
        dates: 'Jan 2022 – Apr 2023',
        highlights: [
          { text: 'Designed and implemented a Continuous Delivery System for managing A/B deployments across multiple Kubernetes clusters with matrix-based monitoring and automatic rollbacks.', blogSlug: 'continuous-delivery-system' },
          { text: 'Built a Kubernetes operator for consistent setup and upgrades of log collectors and monitoring systems across clusters.', blogSlug: 'kubernetes-operator' },
          { text: 'Developed internal platforms including a matrix adapter for autoscaling, a task manager for on-call operations, and an onboarding dashboard.' },
        ],
      },
    ],
  },
]

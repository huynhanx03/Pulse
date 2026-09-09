import type { ReactNode } from 'react'

interface SectionHeadingProps {
  eyebrow?: string
  title: string
  description: string
  actions?: ReactNode
}

export const SectionHeading = ({ eyebrow, title, description, actions }: SectionHeadingProps) => (
  <header className="flex shrink-0 flex-wrap items-center gap-4 border-b border-border bg-surface px-5 py-4 md:px-8">
    <div className="min-w-0 flex-[1_1_20rem]">
      {eyebrow ? (
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-accent">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-lg font-semibold tracking-[-0.02em] text-ink md:text-xl">{title}</h1>
      <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-muted md:text-[13px]">
        {description}
      </p>
    </div>
    {actions ? <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div> : null}
  </header>
)

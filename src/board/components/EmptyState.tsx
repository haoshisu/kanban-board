type EmptyStateProps = {
  title: string
  description: string
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-ink-muted/40 bg-card/40 p-6 text-center">
      <h3 className="font-display text-base font-semibold uppercase tracking-wide text-ink">{title}</h3>
      <p className="mt-2 text-sm text-ink-muted">{description}</p>
    </div>
  )
}

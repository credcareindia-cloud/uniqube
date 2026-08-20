import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'

type Props = {
  title: string
  description: string
  ctaLabel?: string
  ctaHref?: string
}

export function OpsPlaceholderPage({
  title,
  description,
  ctaLabel,
  ctaHref,
}: Props) {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const href = ctaHref ?? (id ? `/projects/${id}` : '/projects')
  const label = ctaLabel ?? (id ? 'Back to Project' : 'Go to Projects')

  return (
    <div className="max-w-[1400px] mx-auto">
      <h1 className="text-2xl font-bold text-[var(--uq-ink)] mb-2">{title}</h1>
      <p className="text-[var(--uq-muted)] max-w-xl">{description}</p>
      <Button
        className="mt-6 uq-btn hover:bg-[var(--uq-yellow-hover)]"
        onClick={() => navigate(href)}
      >
        {label}
      </Button>
    </div>
  )
}

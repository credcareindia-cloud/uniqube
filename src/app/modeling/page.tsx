import { Box } from 'lucide-react'
import { QubeCharacter } from '@/components/ui/QubeCharacter'

export default function ModelingPage() {
  return (
    <div className="w-full max-w-[900px] mx-auto py-10">
      <div className="rounded-3xl border border-black/5 bg-[var(--uq-offwhite)] px-6 py-14 text-center sm:px-10">
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--uq-yellow-soft)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--uq-ink)]">
          <Box className="h-3.5 w-3.5" />
          Beta
        </div>
        <QubeCharacter mood="cute" size={120} className="mb-3" />
        <h1 className="text-2xl font-semibold text-[var(--uq-ink)]">Modeling</h1>
        <p className="mt-2 mx-auto max-w-md text-[var(--uq-muted)]">
          The modeling workspace is coming soon. You&apos;ll manage BIM models and revisions here once this beta feature opens.
        </p>
      </div>
    </div>
  )
}

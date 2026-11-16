import { FileSpreadsheet } from 'lucide-react'
import { QubeCharacter } from '@/components/ui/QubeCharacter'

export default function FinalQuotationPage() {
  return (
    <div className="w-full max-w-[900px] mx-auto py-10">
      <div className="rounded-3xl border border-black/5 bg-[var(--uq-offwhite)] px-6 py-14 text-center sm:px-10">
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--uq-blue)] text-white">
          <FileSpreadsheet className="h-5 w-5" />
        </div>
        <QubeCharacter mood="cute" size={100} className="mb-3" />
        <h1 className="text-2xl font-semibold text-[var(--uq-ink)]">Final Quotation</h1>
        <p className="mt-2 mx-auto max-w-md text-[var(--uq-muted)]">
          Issued, locked quotations will live here once modeling handoff is complete. Working takeoffs stay under Rough Estimation.
        </p>
      </div>
    </div>
  )
}

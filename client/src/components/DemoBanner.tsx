import { useState } from 'react'
import { RotateCcw, X } from 'lucide-react'
import { CASE_STUDY_URL } from '@/lib/brand'
import { resetDemoData } from '@/platform/store'

const STORAGE_KEY = 'demo-banner-dismissed'

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Slim, dismissible notice shown at the top of every page of the portfolio demo.
 * Dismissal is remembered for the browser session only.
 */
export default function DemoBanner() {
  const [dismissed, setDismissed] = useState(readDismissed)

  if (dismissed) return null

  const dismiss = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // sessionStorage unavailable (private mode etc.) — dismiss for this render only
    }
    setDismissed(true)
  }

  return (
    <div
      role="note"
      className="flex h-8 w-full items-center justify-center gap-3 border-b border-border bg-muted px-3 text-xs text-muted-foreground"
    >
      <span className="truncate">
        Portfolio demo · synthetic fleet · identity and financial fields redacted
      </span>
      <a
        href={CASE_STUDY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 underline underline-offset-2 hover:text-foreground"
      >
        How it was built →
      </a>
      <button
        type="button"
        onClick={() => {
          resetDemoData()
          window.location.assign('/')
        }}
        className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 hover:bg-foreground/10 hover:text-foreground"
        title="Restore the seeded demo data"
      >
        <RotateCcw className="size-3" />
        Reset data
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss demo notice"
        className="ml-1 inline-flex size-6 shrink-0 items-center justify-center rounded hover:bg-foreground/10 hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

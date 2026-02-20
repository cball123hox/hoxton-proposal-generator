import { CheckCircle, Loader2 } from 'lucide-react'
import type { UploadProgress } from '../../../lib/upload'

interface BulkUploadProgressProps {
  progress: UploadProgress
}

export function BulkUploadProgress({ progress }: BulkUploadProgressProps) {
  const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0
  const done = progress.completed === progress.total

  return (
    <div className="rounded-xl border border-hoxton-turquoise/30 bg-hoxton-turquoise/5 p-4">
      <div className="mb-2 flex items-center gap-2">
        {done ? (
          <CheckCircle className="h-4 w-4 text-emerald-500" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-hoxton-turquoise" />
        )}
        <span className="text-sm font-heading font-medium text-hoxton-deep">
          {done
            ? `${progress.total} slide${progress.total !== 1 ? 's' : ''} uploaded`
            : `Uploading slide ${progress.completed + 1} of ${progress.total}...`}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-hoxton-grey">
        <div
          className="h-full rounded-full bg-hoxton-turquoise transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      {!done && (
        <p className="mt-1.5 text-xs font-body text-hoxton-slate">
          {progress.currentFile}
        </p>
      )}
    </div>
  )
}

import { useState } from 'react'
import { DownloadIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { TabGroupRecord, TabRecord } from '../../domain/browser'
import { createDownloadGateway } from '../../platform/download-gateway'
import type { DownloadGateway } from '../../platform/download-gateway'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../shared/ui/dialog'
import { Button } from '../../shared/ui/button'
import { Separator } from '../../shared/ui/separator'
import {
  EXPORT_FIELDS,
  EXPORT_FIELD_LABELS,
  buildExportRows,
  serializeCsv,
  serializeJson,
} from './export-format'
import type { ExportField } from './export-format'

type ExportFileFormat = 'csv' | 'json'

const FORMAT_LABELS: Record<ExportFileFormat, string> = { csv: 'CSV', json: 'JSON' }
const FORMAT_MIME_TYPES: Record<ExportFileFormat, string> = {
  csv: 'text/csv;charset=utf-8',
  json: 'application/json;charset=utf-8',
}

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tabs: readonly TabRecord[]
  groups: readonly TabGroupRecord[]
  download?: DownloadGateway
}

export function ExportDialog({
  open,
  onOpenChange,
  tabs,
  groups,
  download = createDownloadGateway(),
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFileFormat>('csv')
  const [selectedFields, setSelectedFields] = useState<ReadonlySet<ExportField>>(
    () => new Set(EXPORT_FIELDS),
  )

  const orderedFields = EXPORT_FIELDS.filter((field) => selectedFields.has(field))
  const canExport = orderedFields.length > 0

  const toggleField = (field: ExportField) => {
    setSelectedFields((current) => {
      const next = new Set(current)

      if (next.has(field)) {
        next.delete(field)
      } else {
        next.add(field)
      }

      return next
    })
  }

  const handleExport = () => {
    const rows = buildExportRows(tabs, groups)
    const contents =
      format === 'csv' ? serializeCsv(rows, orderedFields) : serializeJson(rows, orderedFields)
    const filename = `tab-toolkit-${todayStamp()}.${format}`

    try {
      download.download({ filename, mimeType: FORMAT_MIME_TYPES[format], contents })
    } catch {
      toast.error('Could not export tabs. Try again.')
      return
    }

    toast.success(tabs.length === 1 ? 'Exported 1 tab' : `Exported ${tabs.length} tabs`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => onOpenChange(nextOpen)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export tabs</DialogTitle>
          <DialogDescription>Save the selected tabs to a local file.</DialogDescription>
        </DialogHeader>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Format
          </legend>
          <div className="flex items-center gap-4">
            {(Object.keys(FORMAT_LABELS) as ExportFileFormat[]).map((fileFormat) => (
              <label
                key={fileFormat}
                className="flex cursor-pointer items-center gap-2 text-[13px]"
              >
                <input
                  type="radio"
                  name="export-format"
                  checked={format === fileFormat}
                  onChange={() => setFormat(fileFormat)}
                  className="size-4 shrink-0 cursor-pointer accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                {FORMAT_LABELS[fileFormat]}
              </label>
            ))}
          </div>
        </fieldset>

        <Separator />

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Fields
          </legend>
          {EXPORT_FIELDS.map((field) => (
            <label
              key={field}
              className="flex cursor-pointer items-center gap-2 py-0.5 text-[13px]"
            >
              <input
                type="checkbox"
                checked={selectedFields.has(field)}
                aria-label={EXPORT_FIELD_LABELS[field]}
                onChange={() => toggleField(field)}
                className="size-4 shrink-0 cursor-pointer accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              {EXPORT_FIELD_LABELS[field]}
            </label>
          ))}
        </fieldset>

        <DialogFooter>
          <Button variant="default" onClick={handleExport} disabled={!canExport}>
            <DownloadIcon />
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function todayStamp(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

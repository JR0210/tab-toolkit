import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export interface RadioOption<Value> {
  value: Value
  label: ReactNode
}

interface RadioGroupProps<Value> {
  legend: string
  /** Extra classes for the legend, e.g. 'truncate' for a long URL. */
  legendClassName?: string
  name: string
  options: readonly RadioOption<Value>[]
  value: Value
  onChange: (value: Value) => void
  /**
   * 'wrap' lays options out inline (short labels like Light/Dark/System).
   * 'stack' (default) lists one option per row, for longer labels like a
   * group name or "Keep {tab title}".
   */
  layout?: 'wrap' | 'stack'
}

export function RadioGroup<Value>({
  legend,
  legendClassName,
  name,
  options,
  value,
  onChange,
  layout = 'stack',
}: RadioGroupProps<Value>) {
  const items = options.map((option) => (
    <RadioOptionRow
      key={String(option.value)}
      name={name}
      option={option}
      checked={option.value === value}
      onChange={onChange}
      compact={layout === 'wrap'}
    />
  ))

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend
        className={cn(
          'mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase',
          legendClassName,
        )}
      >
        {legend}
      </legend>
      {layout === 'wrap' ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">{items}</div>
      ) : (
        items
      )}
    </fieldset>
  )
}

function RadioOptionRow<Value>({
  name,
  option,
  checked,
  onChange,
  compact,
}: {
  name: string
  option: RadioOption<Value>
  checked: boolean
  onChange: (value: Value) => void
  /** Skips the row's vertical padding for the inline 'wrap' layout. */
  compact: boolean
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 text-[13px] ${compact ? '' : 'py-0.5'}`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={() => onChange(option.value)}
        className="size-4 shrink-0 cursor-pointer accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      {option.label}
    </label>
  )
}

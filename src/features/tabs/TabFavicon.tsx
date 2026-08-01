import { useState } from 'react'

interface TabFaviconProps {
  faviconUrl: string | null
  fallbackLabel: string
}

export function TabFavicon({ faviconUrl, fallbackLabel }: TabFaviconProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  if (faviconUrl && faviconUrl !== failedUrl) {
    return (
      <span
        aria-hidden="true"
        className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-muted"
      >
        <img
          src={faviconUrl}
          alt=""
          className="size-4 object-contain"
          onError={() => setFailedUrl(faviconUrl)}
        />
      </span>
    )
  }

  return (
    <span
      aria-hidden="true"
      className="flex size-5 shrink-0 items-center justify-center rounded-[5px] bg-secondary text-[10px] font-semibold text-muted-foreground"
    >
      {fallbackLabel.charAt(0).toUpperCase() || '?'}
    </span>
  )
}

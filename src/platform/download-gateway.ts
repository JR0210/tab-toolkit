export interface DownloadRequest {
  filename: string
  mimeType: string
  contents: string
}

export interface DownloadGateway {
  download(request: DownloadRequest): void
}

export function createDownloadGateway(): DownloadGateway {
  return {
    download({ filename, mimeType, contents }) {
      const blob = new Blob([contents], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')

      anchor.href = url
      anchor.download = sanitizeFilename(filename)
      document.body.appendChild(anchor)

      try {
        anchor.click()
      } finally {
        anchor.remove()
        URL.revokeObjectURL(url)
      }
    },
  }
}

function sanitizeFilename(filename: string): string {
  return filename.replaceAll(/[/\\]/g, '-')
}

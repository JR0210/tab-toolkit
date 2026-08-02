export interface ClipboardGateway {
  writeText(text: string): Promise<void>
}

export function createClipboardGateway(): ClipboardGateway {
  return {
    writeText(text) {
      return navigator.clipboard.writeText(text)
    },
  }
}

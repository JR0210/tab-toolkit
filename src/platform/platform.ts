export type PlatformFamily = 'mac' | 'non-mac'

/**
 * Maps a raw Chrome platform info shape to the two families this popup
 * cares about. Anything that isn't literally 'mac' falls back to 'non-mac'
 * (never the other way around) so Windows/Linux/ChromeOS never accidentally
 * render a Command glyph because of an unrecognised os string.
 */
export function toPlatformFamily(info: { os: string; arch?: string }): PlatformFamily {
  return info.os === 'mac' ? 'mac' : 'non-mac'
}

export function modifierLabel(platform: PlatformFamily): string {
  return platform === 'mac' ? '⌘' : 'Ctrl'
}

export function destructiveKeyLabel(platform: PlatformFamily): string {
  return platform === 'mac' ? '⌫' : 'Delete'
}

interface PlatformInfoSource {
  getPlatformInfo(): Promise<PlatformFamily>
}

// Keyed by gateway instance (not a single module-level value) so each
// BrowserGateway -- one per popup load in the real app, a fresh stub per
// test -- gets its own cache instead of tests leaking a resolved family into
// each other.
const familyCache = new WeakMap<PlatformInfoSource, Promise<PlatformFamily>>()

/**
 * Resolves and memoizes the platform family for the lifetime of a given
 * gateway (effectively the popup's lifetime, since one gateway instance is
 * created per popup load).
 */
export function getPlatformFamily(gateway: PlatformInfoSource): Promise<PlatformFamily> {
  const cached = familyCache.get(gateway)

  if (cached) {
    return cached
  }

  const resolved = gateway.getPlatformInfo()
  familyCache.set(gateway, resolved)
  return resolved
}

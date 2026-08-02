import type { TabRecord } from '../../domain/browser'

export interface DuplicateSet {
  url: string
  candidates: TabRecord[]
  keepId: number
}

/**
 * Picks which of a duplicate set's candidates should survive by default:
 * pinned beats everything, then active beats the rest, then the lowest
 * (earliest) window index wins.
 */
export function chooseDefaultKeeper(candidates: readonly TabRecord[]): number {
  const pinned = candidates.find((tab) => tab.pinned)
  if (pinned) {
    return pinned.id
  }

  const active = candidates.find((tab) => tab.active)
  if (active) {
    return active.id
  }

  return [...candidates].sort((left, right) => left.index - right.index)[0].id
}

/**
 * Groups the GIVEN selection (never the full snapshot) by exact URL string
 * equality -- no normalization, so a trailing slash or a scheme difference
 * is never treated as a duplicate. Only URLs with 2 or more occurrences
 * within the selection become a DuplicateSet.
 */
export function findDuplicateSets(selectedTabs: readonly TabRecord[]): DuplicateSet[] {
  const byUrl = new Map<string, TabRecord[]>()

  for (const tab of selectedTabs) {
    const candidates = byUrl.get(tab.url) ?? []
    candidates.push(tab)
    byUrl.set(tab.url, candidates)
  }

  const sets: DuplicateSet[] = []

  for (const [url, candidates] of byUrl) {
    if (candidates.length < 2) {
      continue
    }

    sets.push({ url, candidates, keepId: chooseDefaultKeeper(candidates) })
  }

  return sets
}

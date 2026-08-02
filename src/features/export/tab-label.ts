import type { TabRecord } from '../../domain/browser'

export const UNTITLED_TAB_LABEL = 'Untitled tab'

export function tabLabel(tab: Pick<TabRecord, 'title'>): string {
  return tab.title || UNTITLED_TAB_LABEL
}
